import { and, asc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import { exerciseAliases, exerciseSets, exercises, restIntervals, sessionExercises, syncChanges, syncMutations, userProfiles, workoutPlanExercises, workoutPlans, workoutSessions } from "./db/schema";
import type { Exercise } from "@/domain/types";
import { payloadSchemas, type SyncRequest } from "./sync-contract";
import { planRemovalMode, resolvePlanOperation } from "./sync-policy";

export async function synchronize(userId: string, request: SyncRequest) {
  const acceptedIds: string[] = [];
  const exerciseResolutions: Array<{ mutationId: string; requestedId: string; exercise: Exercise }> = [];
  for (const mutation of request.mutations) {
    await db.transaction(async (tx) => {
      const [duplicate] = await tx.select({ id: syncMutations.id }).from(syncMutations).where(and(eq(syncMutations.id, mutation.id), eq(syncMutations.userId, userId))).limit(1);
      if (duplicate) {
        if (mutation.entityType === "exercise" && mutation.operation === "upsert") {
          const exercise = await resolveSharedExercise(tx, userId, mutation.payload);
          if (exercise) exerciseResolutions.push({ mutationId: mutation.id, requestedId: mutation.entityId, exercise });
        }
        acceptedIds.push(mutation.id);
        return;
      }
      let operation = mutation.operation;
      if (mutation.entityType === "plan" && mutation.operation === "upsert") {
        const [deletedPlan] = await tx.select({ cursor: syncChanges.cursor }).from(syncChanges).where(and(eq(syncChanges.userId, userId), eq(syncChanges.entityType, "plan"), eq(syncChanges.entityId, mutation.entityId), eq(syncChanges.operation, "delete"))).limit(1);
        operation = resolvePlanOperation(mutation.operation, Boolean(deletedPlan));
      }
      if (operation === "delete") await applyDelete(tx, userId, mutation.entityType, mutation.entityId);
      else {
        const exercise = await applyUpsert(tx, userId, mutation.entityType, mutation.payload);
        if (exercise) exerciseResolutions.push({ mutationId: mutation.id, requestedId: mutation.entityId, exercise });
      }
      await tx.insert(syncMutations).values({ id: mutation.id, userId });
      if (mutation.entityType !== "exercise") await tx.insert(syncChanges).values({ userId, entityType: mutation.entityType, entityId: mutation.entityId, operation, payload: operation === "upsert" ? mutation.payload : null });
      acceptedIds.push(mutation.id);
    });
  }
  const changes = await db.select().from(syncChanges).where(and(eq(syncChanges.userId, userId), gt(syncChanges.cursor, request.cursor))).orderBy(asc(syncChanges.cursor)).limit(501);
  const page = changes.slice(0, 500);
  return { acceptedIds, exerciseResolutions, changes: page.map(({ cursor, entityType, entityId, operation, payload }) => ({ cursor, entityType, entityId, operation, payload })), nextCursor: page.at(-1)?.cursor ?? request.cursor, hasMore: changes.length > page.length, serverTime: Date.now() };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyUpsert(tx: Transaction, userId: string, entityType: SyncRequest["mutations"][number]["entityType"], payload: unknown): Promise<Exercise | undefined> {
  if (entityType === "exercise") {
    return await resolveSharedExercise(tx, userId, payload);
  }
  if (entityType === "profile") {
    const profile = payloadSchemas.profile.parse(payload);
    await tx.insert(userProfiles).values({ userId, displayName: profile.name, weightUnit: profile.weightUnit, weeklyGoal: profile.weeklyGoal, timezone: profile.timezone }).onConflictDoUpdate({ target: userProfiles.userId, set: { displayName: profile.name, weightUnit: profile.weightUnit, weeklyGoal: profile.weeklyGoal, timezone: profile.timezone, updatedAt: new Date() } });
    return undefined;
  }
  if (entityType === "plan") {
    const plan = payloadSchemas.plan.parse(payload);
    const [existingPlan] = await tx.select({ userId: workoutPlans.userId }).from(workoutPlans).where(eq(workoutPlans.id, plan.id)).limit(1);
    if (existingPlan && existingPlan.userId !== userId) throw new Error("Plan is not owned by this user");
    const exerciseIds = await canonicalExerciseIds(tx, plan.exerciseIds);
    const permitted = await tx.select({ id: exercises.id }).from(exercises).where(and(inArray(exercises.id, exerciseIds), isNull(exercises.deletedAt)));
    if (exerciseIds.some((id) => !new Set(permitted.map((item) => item.id)).has(id))) throw new Error("Plan contains an unavailable exercise");
    await tx.insert(workoutPlans).values({ id: plan.id, userId, name: plan.name, restSeconds: plan.restSeconds }).onConflictDoUpdate({ target: workoutPlans.id, set: { name: plan.name, restSeconds: plan.restSeconds, updatedAt: new Date(), deletedAt: null, revision: 2 } });
    await tx.delete(workoutPlanExercises).where(eq(workoutPlanExercises.planId, plan.id));
    await tx.insert(workoutPlanExercises).values(exerciseIds.map((exerciseId, position) => ({ id: crypto.randomUUID(), planId: plan.id, exerciseId, position })));
    return undefined;
  }
  const session = payloadSchemas.session.parse(payload);
  const [existing] = await tx.select({ userId: workoutSessions.userId, status: workoutSessions.status }).from(workoutSessions).where(eq(workoutSessions.id, session.id)).limit(1);
  if (existing && existing.userId !== userId) throw new Error("Session is not owned by this user");
  if (existing?.status === "completed" || existing?.status === "completed_early") throw new Error("Completed sessions are immutable");
  const [sourcePlan] = await tx.select({ id: workoutPlans.id }).from(workoutPlans).where(and(eq(workoutPlans.id, session.planId), eq(workoutPlans.userId, userId), isNull(workoutPlans.deletedAt))).limit(1);
  await tx.insert(workoutSessions).values({ id: session.id, userId, deviceId: session.deviceId, sourcePlanId: sourcePlan?.id ?? null, planName: session.planName, restSeconds: session.restSeconds, status: session.status, currentExerciseIndex: session.currentExerciseIndex, startedAt: new Date(session.startedAt), endedAt: session.endedAt ? new Date(session.endedAt) : null, pausedAt: session.pausedAt ? new Date(session.pausedAt) : null, pausedMs: session.pausedMs, restMs: session.restMs, activeState: session.rest ?? null }).onConflictDoUpdate({ target: workoutSessions.id, set: { status: session.status, currentExerciseIndex: session.currentExerciseIndex, endedAt: session.endedAt ? new Date(session.endedAt) : null, pausedAt: session.pausedAt ? new Date(session.pausedAt) : null, pausedMs: session.pausedMs, restMs: session.restMs, activeState: session.rest ?? null, updatedAt: new Date(), revision: 2 } });
  await tx.delete(sessionExercises).where(eq(sessionExercises.sessionId, session.id));
  await tx.insert(sessionExercises).values(session.exercises.map((exercise, position) => ({ id: exercise.id, sessionId: session.id, sourceExerciseId: exercise.sourceExerciseId, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, status: exercise.status, position })));
  const sets = session.exercises.flatMap((exercise) => exercise.sets.map((set, position) => ({ id: set.id, sessionExerciseId: exercise.id, position, reps: set.reps, weightKg: set.weightKg?.toString(), completedAt: new Date(set.completedAt) })));
  if (sets.length) await tx.insert(exerciseSets).values(sets);
  if (session.rests.length) await tx.insert(restIntervals).values(session.rests.map((rest) => ({ id: rest.id, sessionId: session.id, setId: rest.setId, startedAt: new Date(rest.startedAt), targetEndedAt: new Date(rest.targetEndedAt), endedAt: new Date(rest.endedAt), actualMs: rest.actualMs, endReason: rest.endReason })));
  return undefined;
}

async function applyDelete(tx: Transaction, userId: string, entityType: SyncRequest["mutations"][number]["entityType"], entityId: string) {
  if (entityType === "plan") {
    const [plan] = await tx.select({ id: workoutPlans.id }).from(workoutPlans).where(and(eq(workoutPlans.id, entityId), eq(workoutPlans.userId, userId))).limit(1);
    if (!plan) return;
    const [session] = await tx.select({ id: workoutSessions.id }).from(workoutSessions).where(and(eq(workoutSessions.sourcePlanId, entityId), eq(workoutSessions.userId, userId))).limit(1);
    await tx.delete(workoutPlanExercises).where(eq(workoutPlanExercises.planId, plan.id));
    if (planRemovalMode(Boolean(session)) === "archive") {
      await tx.update(workoutPlans).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(workoutPlans.id, entityId), eq(workoutPlans.userId, userId)));
    } else {
      await tx.delete(workoutPlans).where(and(eq(workoutPlans.id, entityId), eq(workoutPlans.userId, userId)));
    }
    return;
  }
  if (entityType === "exercise") throw new Error("Shared exercises can only be retired by an administrator");
  if (entityType === "session") {
    const [session] = await tx.select({ status: workoutSessions.status, sourcePlanId: workoutSessions.sourcePlanId }).from(workoutSessions).where(and(eq(workoutSessions.id, entityId), eq(workoutSessions.userId, userId))).limit(1);
    await tx.delete(workoutSessions).where(and(eq(workoutSessions.id, entityId), eq(workoutSessions.userId, userId)));
    if (session?.sourcePlanId) {
      const [remainingSession] = await tx.select({ id: workoutSessions.id }).from(workoutSessions).where(and(eq(workoutSessions.sourcePlanId, session.sourcePlanId), eq(workoutSessions.userId, userId))).limit(1);
      if (!remainingSession) await tx.delete(workoutPlans).where(and(eq(workoutPlans.id, session.sourcePlanId), eq(workoutPlans.userId, userId), isNotNull(workoutPlans.deletedAt)));
    }
  }
}

async function resolveSharedExercise(tx: Transaction, userId: string, payload: unknown) {
  const input = payloadSchemas.exercise.parse(payload);
  if (input.builtin) return undefined;
  const [alias] = await tx.select().from(exerciseAliases).where(eq(exerciseAliases.id, input.id)).limit(1);
  const [byId] = await tx.select().from(exercises).where(eq(exercises.id, alias?.canonicalId ?? input.id)).limit(1);
  if (byId) return serializeExercise(byId);
  const normalizedName = normalizeExerciseName(input.name);
  const [existing] = await tx.select().from(exercises).where(eq(exercises.normalizedName, normalizedName)).limit(1);
  if (existing) {
    await tx.insert(exerciseAliases).values({ id: input.id, canonicalId: existing.id }).onConflictDoNothing();
    return serializeExercise(existing);
  }
  const [created] = await tx.insert(exercises).values({ id: input.id, createdByUserId: userId, name: input.name.trim(), normalizedName, muscleGroup: input.muscleGroup, equipment: input.equipment, builtin: false }).returning();
  return serializeExercise(created);
}

async function canonicalExerciseIds(tx: Transaction, ids: string[]) {
  const aliases = await tx.select().from(exerciseAliases).where(inArray(exerciseAliases.id, ids));
  const canonicalById = new Map(aliases.map((alias) => [alias.id, alias.canonicalId]));
  return ids.map((id) => canonicalById.get(id) ?? id);
}

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function serializeExercise(exercise: typeof exercises.$inferSelect): Exercise {
  return { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup as Exercise["muscleGroup"], equipment: exercise.equipment as Exercise["equipment"], builtin: exercise.builtin, updatedAt: exercise.updatedAt.getTime(), ...(exercise.retiredAt ? { retiredAt: exercise.retiredAt.getTime() } : {}) };
}
