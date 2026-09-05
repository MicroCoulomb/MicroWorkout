import { describe, expect, it } from "vitest";
import { elapsedWorkoutMs, formatDuration, kgToLb, lbToKg, sessionTotals } from "./metrics";
import type { WorkoutSession } from "./types";

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-1",
    deviceId: "device-1",
    planId: "plan-1",
    planName: "Push",
    restSeconds: 60,
    status: "completed",
    currentExerciseIndex: 0,
    startedAt: 1_000,
    endedAt: 611_000,
    pausedMs: 10_000,
    restMs: 120_000,
    rests: [],
    updatedAt: 611_000,
    exercises: [{
      id: "exercise-1",
      sourceExerciseId: "00000000-0000-4000-8000-000000000001",
      name: "Push-Up",
      muscleGroup: "Chest",
      equipment: "Bodyweight",
      status: "completed",
      sets: [
        { id: "set-1", reps: 12, weightKg: null, completedAt: 20_000 },
        { id: "set-2", reps: 10, weightKg: 20, completedAt: 100_000 },
      ],
    }],
    ...overrides,
  };
}

describe("workout metrics", () => {
  it("formats minute and hour durations", () => {
    expect(formatDuration(90_000)).toBe("01:30");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
  });

  it("excludes paused time from elapsed time", () => {
    expect(elapsedWorkoutMs(session())).toBe(600_000);
  });

  it("derives report totals without counting bodyweight as load", () => {
    expect(sessionTotals(session())).toEqual({
      exercises: 1,
      sets: 2,
      reps: 22,
      volumeKg: 200,
      workoutMs: 600_000,
      restMs: 120_000,
      activeMs: 480_000,
    });
  });

  it("round-trips weight units", () => {
    expect(lbToKg(kgToLb(25))).toBeCloseTo(25);
  });
});
