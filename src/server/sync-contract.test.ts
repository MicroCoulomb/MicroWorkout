import { describe, expect, it } from "vitest";
import { payloadSchemas, syncRequestSchema } from "./sync-contract";

describe("sync contract", () => {
  it("accepts an ordered plan mutation", () => {
    const plan = { id: crypto.randomUUID(), name: "Push", restSeconds: 60, exerciseIds: [crypto.randomUUID()], updatedAt: Date.now() };
    expect(syncRequestSchema.parse({ cursor: 0, mutations: [{ id: crypto.randomUUID(), entityType: "plan", entityId: plan.id, operation: "upsert", payload: plan, createdAt: Date.now() }] }).mutations).toHaveLength(1);
  });

  it("rejects plans without exercises", () => {
    expect(() => payloadSchemas.plan.parse({ id: crypto.randomUUID(), name: "Empty", restSeconds: 60, exerciseIds: [], updatedAt: Date.now() })).toThrow();
  });

  it("rejects invalid set measurements", () => {
    const session = {
      id: crypto.randomUUID(), deviceId: "device", planId: crypto.randomUUID(), planName: "Push", restSeconds: 60,
      status: "active", currentExerciseIndex: 0, startedAt: Date.now(), pausedMs: 0, restMs: 0, rests: [], updatedAt: Date.now(),
      exercises: [{ id: crypto.randomUUID(), sourceExerciseId: crypto.randomUUID(), name: "Push-Up", muscleGroup: "Chest", equipment: "Bodyweight", status: "pending", sets: [{ id: crypto.randomUUID(), reps: 0, weightKg: null, completedAt: Date.now() }] }],
    };
    expect(() => payloadSchemas.session.parse(session)).toThrow();
  });
});
