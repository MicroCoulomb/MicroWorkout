import Dexie, { type EntityTable } from "dexie";
import { BUILTIN_EXERCISES } from "@/domain/presets";
import type { Exercise, ExerciseAlias, OutboxMutation, SyncMeta, UserProfile, WorkoutPlan, WorkoutSession } from "@/domain/types";

export class MicroWorkoutDatabase extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  exerciseAliases!: EntityTable<ExerciseAlias, "id">;
  plans!: EntityTable<WorkoutPlan, "id">;
  sessions!: EntityTable<WorkoutSession, "id">;
  profiles!: EntityTable<UserProfile, "id">;
  outbox!: EntityTable<OutboxMutation, "id">;
  syncMeta!: EntityTable<SyncMeta, "id">;

  constructor(userId: string) {
    super(`microworkout-${userId}`);
    this.version(1).stores({
      exercises: "id, name, muscleGroup, equipment, builtin, updatedAt",
      plans: "id, name, updatedAt",
      sessions: "id, deviceId, status, startedAt, updatedAt",
      profiles: "id",
      outbox: "id, entityType, entityId, createdAt",
    });
    this.version(2).stores({
      exercises: "id, name, muscleGroup, equipment, builtin, updatedAt",
      plans: "id, name, updatedAt",
      sessions: "id, deviceId, status, startedAt, updatedAt",
      profiles: "id",
      outbox: "id, entityType, entityId, createdAt",
      syncMeta: "id",
    });
    this.version(3).stores({
      exercises: "id, name, muscleGroup, equipment, builtin, updatedAt, retiredAt",
      exerciseAliases: "id, canonicalId",
      plans: "id, name, updatedAt",
      sessions: "id, deviceId, status, startedAt, updatedAt",
      profiles: "id",
      outbox: "id, entityType, entityId, createdAt",
      syncMeta: "id",
    });
    this.version(4).stores({
      exercises: "id, name, muscleGroup, equipment, builtin, updatedAt, retiredAt",
      exerciseAliases: "id, canonicalId",
      plans: "id, name, updatedAt",
      sessions: "id, deviceId, status, startedAt, updatedAt",
      profiles: "id",
      outbox: "id, entityType, entityId, createdAt",
      syncMeta: "id",
    }).upgrade(async (tx) => {
      await tx.table("exercises").toCollection().modify((exercise: Exercise) => { exercise.muscleGroup = currentMuscleGroup(exercise.muscleGroup); });
      await tx.table("outbox").where("entityType").equals("exercise").modify((mutation: OutboxMutation) => {
        if (!mutation.payload) return;
        const exercise = mutation.payload as Exercise;
        mutation.payload = { ...exercise, muscleGroup: currentMuscleGroup(exercise.muscleGroup) };
      });
    });
  }
}

function currentMuscleGroup(group: string): Exercise["muscleGroup"] {
  if (group === "Back") return "Lats";
  if (group === "Shoulders") return "Front Delts";
  if (group === "Arms") return "Biceps";
  if (group === "Legs") return "Quads";
  return group as Exercise["muscleGroup"];
}

export async function initializeLocalData(db: MicroWorkoutDatabase, name: string, initialProfile?: UserProfile) {
  const now = Date.now();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila";
  await db.transaction("rw", db.exercises, db.profiles, db.outbox, async () => {
    const builtinIds = BUILTIN_EXERCISES.map((exercise) => exercise.id);
    const existingBuiltins = await db.exercises.bulkGet(builtinIds);
    await db.exercises.bulkAdd(BUILTIN_EXERCISES.filter((_, index) => !existingBuiltins[index]).map((exercise) => ({ ...exercise, updatedAt: now })));
    if (!(await db.profiles.get("profile"))) {
      const profile: UserProfile = initialProfile ?? {
        id: "profile",
        name,
        weightUnit: "kg",
        weeklyGoal: 3,
        timezone,
        lastVerifiedAt: now,
      };
      await db.profiles.add(profile);
      if (!initialProfile) {
        await db.outbox.add({ id: crypto.randomUUID(), entityType: "profile", entityId: "profile", operation: "upsert", payload: profile, createdAt: now });
      }
    }
  });
}

export function deviceId(userId: string) {
  if (typeof window === "undefined") return "server";
  const key = `microworkout-device-id-${userId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export async function queueMutation(db: MicroWorkoutDatabase, mutation: Omit<OutboxMutation, "id" | "createdAt">) {
  await db.outbox.add({ ...mutation, id: crypto.randomUUID(), createdAt: Date.now() });
}
