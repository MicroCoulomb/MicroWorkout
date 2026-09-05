import type { Exercise, OutboxMutation, UserProfile, WorkoutPlan, WorkoutSession } from "@/domain/types";
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
  changes: SyncChange[];
  nextCursor: number;
  serverTime: number;
}

export class SyncRejectedError extends Error {}

export async function synchronizeLocalData(db: MicroWorkoutDatabase) {
  const [meta, mutations] = await Promise.all([db.syncMeta.get("sync"), db.outbox.orderBy("createdAt").toArray()]);
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cursor: meta?.cursor ?? 0, mutations }),
  });
  if (response.status === 401 || response.status === 403) throw new SyncRejectedError("Your session needs to be verified again");
  if (!response.ok) throw new Error("Could not synchronize changes");
  const result = await response.json() as SyncResponse;
  await db.transaction("rw", [db.exercises, db.plans, db.sessions, db.profiles, db.outbox, db.syncMeta], async () => {
    for (const change of result.changes) await applyChange(db, change);
    await db.outbox.bulkDelete(result.acceptedIds);
    await db.syncMeta.put({ id: "sync", cursor: result.nextCursor, lastSyncedAt: result.serverTime });
    const profile = await db.profiles.get("profile");
    if (profile) await db.profiles.put({ ...profile, lastVerifiedAt: result.serverTime });
  });
  return result;
}

async function applyChange(db: MicroWorkoutDatabase, change: SyncChange) {
  const table = change.entityType === "plan" ? db.plans : change.entityType === "exercise" ? db.exercises : change.entityType === "session" ? db.sessions : db.profiles;
  if (change.operation === "delete") { await table.delete(change.entityId as never); return; }
  if (change.entityType === "plan") await db.plans.put(change.payload as WorkoutPlan);
  else if (change.entityType === "exercise") await db.exercises.put(change.payload as Exercise);
  else if (change.entityType === "session") await db.sessions.put(change.payload as WorkoutSession);
  else await db.profiles.put(change.payload as UserProfile);
}
