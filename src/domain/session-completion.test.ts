import { describe, expect, it } from "vitest";
import { completeSessionEarly } from "./session-completion";
import type { WorkoutSession } from "./types";

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-1", deviceId: "device-1", planId: "plan-1", planName: "Push", restSeconds: 60,
    status: "active", currentExerciseIndex: 1, startedAt: 1_000, pausedMs: 0, restMs: 0, rests: [], updatedAt: 1_000,
    exercises: [
      { id: "exercise-1", sourceExerciseId: "push-up", name: "Push-Up", muscleGroup: "Chest", equipment: "Bodyweight", status: "completed", sets: [{ id: "set-1", reps: 10, weightKg: null, completedAt: 2_000 }] },
      { id: "exercise-2", sourceExerciseId: "press", name: "Press", muscleGroup: "Chest", equipment: "Dumbbells", status: "pending", sets: [{ id: "set-2", reps: 8, weightKg: 10, completedAt: 3_000 }] },
      { id: "exercise-3", sourceExerciseId: "raise", name: "Raise", muscleGroup: "Side Delts", equipment: "Dumbbells", status: "pending", sets: [] },
    ],
    ...overrides,
  };
}

describe("completeSessionEarly", () => {
  it("finishes an active rest and skips remaining exercises in one session state", () => {
    const completed = completeSessionEarly(session({ rest: { id: "rest-1", setId: "set-2", originalStartedAt: 3_000, startedAt: 3_000, endsAt: 63_000, accumulatedMs: 0 } }), 13_000);

    expect(completed.status).toBe("completed_early");
    expect(completed.rest).toBeUndefined();
    expect(completed.restMs).toBe(10_000);
    expect(completed.rests).toEqual([expect.objectContaining({ actualMs: 10_000, endReason: "finish" })]);
    expect(completed.exercises.map((exercise) => exercise.status)).toEqual(["completed", "completed", "skipped"]);
  });

  it("finishes without adding rest when no interval is active", () => {
    const completed = completeSessionEarly(session(), 13_000);

    expect(completed.restMs).toBe(0);
    expect(completed.rests).toEqual([]);
    expect(completed.endedAt).toBe(13_000);
  });
});
