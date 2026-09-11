import type { Exercise, ExerciseAlias, OutboxMutation, UserProfile, WorkoutPlan, WorkoutSession } from "@/domain/types";
import type { MicroWorkoutDatabase } from "./local-db";

interface SyncChange {
  cursor: number;
  entityType: OutboxMutation["entityType"];
  entityId: string;
  operation: OutboxMutation["operation"];
  payload: unknown;
}

interface SyncResponse {
  acceptedIds: string[];
  exerciseResolutions?: Array<{ mutationId: string; requestedId: string; exercise: Exercise }>;
  changes: SyncChange[];
  nextCursor: number;
  hasMore: boolean;
  serverTime: number;
}

export class SyncRejectedError extends Error {}

export async function synchronizeLocalData(db: MicroWorkoutDatabase) {
  const meta = await db.syncMeta.get("sync");
  let cursor = meta?.cursor ?? 0;

  while (true) {
    const mutations = await db.outbox.orderBy("createdAt").limit(250).toArray();
    const result = await requestSync(cursor, mutations);
    await applySyncResult(db, result);
    cursor = result.nextCursor;
    if (!result.hasMore && await db.outbox.count() === 0) {
      await synchronizeExerciseCatalog(db);
      return result;
    }
  }
}

async function requestSync(cursor: number, mutations: OutboxMutation[]) {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cursor, mutations }),
  });
  if (response.status === 401 || response.status === 403) throw new SyncRejectedError("Your session needs to be verified again");
  if (!response.ok) throw new Error("Could not synchronize changes");
  return await response.json() as SyncResponse;
}

async function applySyncResult(db: MicroWorkoutDatabase, result: SyncResponse) {
  await db.transaction("rw", [db.exercises, db.exerciseAliases, db.plans, db.sessions, db.profiles, db.outbox, db.syncMeta], async () => {
    await db.outbox.bulkDelete(result.acceptedIds);
    for (const resolution of result.exerciseResolutions ?? []) {
      await db.exercises.put(resolution.exercise);
      await db.exerciseAliases.put({ id: resolution.requestedId, canonicalId: resolution.exercise.id });
    }
    await resolveLocalPlanAliases(db);
    const pendingEntities = new Set((await db.outbox.toArray()).map(({ entityType, entityId }) => `${entityType}:${entityId}`));
    for (const change of result.changes) {
      const hasPendingMutation = pendingEntities.has(`${change.entityType}:${change.entityId}`);
      if (!hasPendingMutation && !await hasNewerLocalVersion(db, change)) await applyChange(db, change);
    }
    await db.syncMeta.put({ id: "sync", cursor: result.nextCursor, lastSyncedAt: result.serverTime });
    const profile = await db.profiles.get("profile");
    if (profile) await db.profiles.put({ ...profile, lastVerifiedAt: result.serverTime });
  });
}

export async function synchronizeExerciseCatalog(db: MicroWorkoutDatabase) {
  const response = await fetch("/api/exercises");
  if (response.status === 401 || response.status === 403) throw new SyncRejectedError("Your session needs to be verified again");
  if (!response.ok) throw new Error("Could not refresh the shared exercise library");
  const catalog = await response.json() as Partial<{ exercises: Exercise[]; aliases: ExerciseAlias[] }>;
  await db.transaction("rw", [db.exercises, db.exerciseAliases, db.plans, db.outbox], async () => {
    await db.exercises.bulkPut(catalog.exercises ?? []);
    await db.exerciseAliases.bulkPut(catalog.aliases ?? []);
    await resolveLocalPlanAliases(db);
  });
}

async function resolveLocalPlanAliases(db: MicroWorkoutDatabase) {
  const aliases = new Map((await db.exerciseAliases.toArray()).map((alias) => [alias.id, alias.canonicalId]));
  if (aliases.size === 0) return;
  const resolveIds = (exerciseIds: string[]) => exerciseIds.map((id) => aliases.get(id) ?? id);
  const plans = await db.plans.toArray();
  const changedPlans = plans.map((plan) => ({ ...plan, exerciseIds: resolveIds(plan.exerciseIds) })).filter((plan, index) => plan.exerciseIds.some((id, itemIndex) => id !== plans[index].exerciseIds[itemIndex]));
  if (changedPlans.length) await db.plans.bulkPut(changedPlans);
  const mutations = await db.outbox.where("entityType").equals("plan").toArray();
  for (const mutation of mutations) {
    if (mutation.operation !== "upsert" || !mutation.payload) continue;
    const plan = mutation.payload as WorkoutPlan;
    const exerciseIds = resolveIds(plan.exerciseIds);
    if (exerciseIds.some((id, index) => id !== plan.exerciseIds[index])) await db.outbox.put({ ...mutation, payload: { ...plan, exerciseIds } });
  }
}

async function hasNewerLocalVersion(db: MicroWorkoutDatabase, change: SyncChange) {
  if (change.operation === "delete" || change.entityType === "profile") return false;
  const incomingUpdatedAt = (change.payload as { updatedAt?: unknown } | null)?.updatedAt;
  if (typeof incomingUpdatedAt !== "number") return false;
  const table = change.entityType === "plan" ? db.plans : change.entityType === "exercise" ? db.exercises : db.sessions;
  const local = await table.get(change.entityId as never) as { updatedAt?: number } | undefined;
  return typeof local?.updatedAt === "number" && local.updatedAt > incomingUpdatedAt;
}

async function applyChange(db: MicroWorkoutDatabase, change: SyncChange) {
  const table = change.entityType === "plan" ? db.plans : change.entityType === "exercise" ? db.exercises : change.entityType === "session" ? db.sessions : db.profiles;
  if (change.operation === "delete") { await table.delete(change.entityId as never); return; }
  if (change.entityType === "plan") await db.plans.put(change.payload as WorkoutPlan);
  else if (change.entityType === "exercise") await db.exercises.put(change.payload as Exercise);
  else if (change.entityType === "session") await db.sessions.put(change.payload as WorkoutSession);
  else await db.profiles.put(change.payload as UserProfile);
}
