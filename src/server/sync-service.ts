import { and, asc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import { exerciseSets, exercises, restIntervals, sessionExercises, syncChanges, syncMutations, userProfiles, workoutPlanExercises, workoutPlans, workoutSessions } from "./db/schema";
import { payloadSchemas, type SyncRequest } from "./sync-contract";
import { planRemovalMode, resolvePlanOperation } from "./sync-policy";

export async function synchronize(userId: string, request: SyncRequest) {
  const acceptedIds: string[] = [];
  for (const mutation of request.mutations) {
    await db.transaction(async (tx) => {
      const [duplicate] = await tx.select({ id: syncMutations.id }).from(syncMutations).where(and(eq(syncMutations.id, mutation.id), eq(syncMutations.userId, userId))).limit(1);
      if (duplicate) { acceptedIds.push(mutation.id); return; }
      let operation = mutation.operation;
      if (mutation.entityType === "plan" && mutation.operation === "upsert") {
        const [deletedPlan] = await tx.select({ cursor: syncChanges.cursor }).from(syncChanges).where(and(eq(syncChanges.userId, userId), eq(syncChanges.entityType, "plan"), eq(syncChanges.entityId, mutation.entityId), eq(syncChanges.operation, "delete"))).limit(1);
        operation = resolvePlanOperation(mutation.operation, Boolean(deletedPlan));
      }
      if (operation === "delete") await applyDelete(tx, userId, mutation.entityType, mutation.entityId);
      else await applyUpsert(tx, userId, mutation.entityType, mutation.payload);
      await tx.insert(syncMutations).values({ id: mutation.id, userId });
      await tx.insert(syncChanges).values({ userId, entityType: mutation.entityType, entityId: mutation.entityId, operation, payload: operation === "upsert" ? mutation.payload : null });
      acceptedIds.push(mutation.id);
    });
  }
  const changes = await db.select().from(syncChanges).where(and(eq(syncChanges.userId, userId), gt(syncChanges.cursor, request.cursor))).orderBy(asc(syncChanges.cursor)).limit(500);
  return { acceptedIds, changes: changes.map(({ cursor, entityType, entityId, operation, payload }) => ({ cursor, entityType, entityId, operation, payload })), nextCursor: changes.at(-1)?.cursor ?? request.cursor, serverTime: Date.now() };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyUpsert(tx: Transaction, userId: string, entityType: SyncRequest["mutations"][number]["entityType"], payload: unknown) {
  if (entityType === "exercise") {
    const exercise = payloadSchemas.exercise.parse(payload);
    if (exercise.builtin) return;
    const [existingExercise] = await tx.select({ userId: exercises.userId }).from(exercises).where(eq(exercises.id, exercise.id)).limit(1);
    if (existingExercise && existingExercise.userId !== userId) throw new Error("Exercise is not owned by this user");
    await tx.insert(exercises).values({ id: exercise.id, userId, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, builtin: false }).onConflictDoUpdate({ target: exercises.id, set: { name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, updatedAt: new Date(), revision: 2 } });
    return;
  }
  if (entityType === "profile") {
    const profile = payloadSchemas.profile.parse(payload);
    await tx.insert(userProfiles).values({ userId, displayName: profile.name, weightUnit: profile.weightUnit, weeklyGoal: profile.weeklyGoal, timezone: profile.timezone }).onConflictDoUpdate({ target: userProfiles.userId, set: { displayName: profile.name, weightUnit: profile.weightUnit, weeklyGoal: profile.weeklyGoal, timezone: profile.timezone, updatedAt: new Date() } });
    return;
  }
  if (entityType === "plan") {
    const plan = payloadSchemas.plan.parse(payload);
    const [existingPlan] = await tx.select({ userId: workoutPlans.userId }).from(workoutPlans).where(eq(workoutPlans.id, plan.id)).limit(1);
    if (existingPlan && existingPlan.userId !== userId) throw new Error("Plan is not owned by this user");
    const allowed = await tx.select({ id: exercises.id }).from(exercises).where(and(inArray(exercises.id, plan.exerciseIds), eq(exercises.builtin, true)));
    const owned = await tx.select({ id: exercises.id }).from(exercises).where(and(inArray(exercises.id, plan.exerciseIds), eq(exercises.userId, userId)));
    const permittedIds = new Set([...allowed, ...owned].map((item) => item.id));
    if (plan.exerciseIds.some((id) => !permittedIds.has(id))) throw new Error("Plan contains an unavailable exercise");
    await tx.insert(workoutPlans).values({ id: plan.id, userId, name: plan.name, restSeconds: plan.restSeconds }).onConflictDoUpdate({ target: workoutPlans.id, set: { name: plan.name, restSeconds: plan.restSeconds, updatedAt: new Date(), deletedAt: null, revision: 2 } });
    await tx.delete(workoutPlanExercises).where(eq(workoutPlanExercises.planId, plan.id));
    await tx.insert(workoutPlanExercises).values(plan.exerciseIds.map((exerciseId, position) => ({ id: crypto.randomUUID(), planId: plan.id, exerciseId, position })));
    return;
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
  if (entityType === "exercise") { await tx.update(exercises).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(exercises.id, entityId), eq(exercises.userId, userId))); return; }
  if (entityType === "session") {
    const [session] = await tx.select({ status: workoutSessions.status, sourcePlanId: workoutSessions.sourcePlanId }).from(workoutSessions).where(and(eq(workoutSessions.id, entityId), eq(workoutSessions.userId, userId))).limit(1);
    if (session?.status === "completed" || session?.status === "completed_early") throw new Error("Completed sessions are immutable");
    await tx.delete(workoutSessions).where(and(eq(workoutSessions.id, entityId), eq(workoutSessions.userId, userId)));
    if (session?.sourcePlanId) {
      const [remainingSession] = await tx.select({ id: workoutSessions.id }).from(workoutSessions).where(and(eq(workoutSessions.sourcePlanId, session.sourcePlanId), eq(workoutSessions.userId, userId))).limit(1);
      if (!remainingSession) await tx.delete(workoutPlans).where(and(eq(workoutPlans.id, session.sourcePlanId), eq(workoutPlans.userId, userId), isNotNull(workoutPlans.deletedAt)));
    }
  }
}
