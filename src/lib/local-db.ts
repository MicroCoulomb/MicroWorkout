import Dexie, { type EntityTable } from "dexie";
import { BUILTIN_EXERCISES } from "@/domain/presets";
import type { Exercise, OutboxMutation, SyncMeta, UserProfile, WorkoutPlan, WorkoutSession } from "@/domain/types";

export class MicroWorkoutDatabase extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
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
  }
}

export async function initializeLocalData(db: MicroWorkoutDatabase, name: string, initialProfile?: UserProfile) {
  const now = Date.now();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila";
  await db.transaction("rw", db.exercises, db.profiles, db.outbox, async () => {
    await db.exercises.bulkPut(BUILTIN_EXERCISES.map((exercise) => ({ ...exercise, updatedAt: now })));
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
