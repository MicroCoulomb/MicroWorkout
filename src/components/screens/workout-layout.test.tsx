// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutPlan, WorkoutSession } from "@/domain/types";
import { WorkoutStartScreen } from "../workout-launcher";
import { WorkoutScreen } from "./workout-screen";

const store = vi.hoisted(() => ({
  exercises: [{ id: "push-up", name: "Push-Up" }],
  profile: { weightUnit: "kg" },
  pendingChanges: 0,
  syncStatus: "local",
  saveSession: vi.fn(async () => undefined),
  discardSession: vi.fn(async () => undefined),
  finishWorkoutEarly: vi.fn(async () => undefined),
}));

vi.mock("@/features/workouts/workout-store", () => ({
  displayWeight: (value: number) => value,
  useWorkoutStore: () => store,
}));

const plan: WorkoutPlan = {
  id: "plan",
  name: "Push",
  restSeconds: 60,
  exerciseIds: ["push-up"],
  updatedAt: 0,
};

const session: WorkoutSession = {
  id: "session",
  deviceId: "device",
  planId: "plan",
  planName: "Push",
  restSeconds: 60,
  status: "active",
  currentExerciseIndex: 0,
  startedAt: 0,
  pausedMs: 0,
  restMs: 0,
  rests: [],
  updatedAt: 0,
  exercises: [{
    id: "session-exercise",
    sourceExerciseId: "push-up",
    name: "Push-Up",
    muscleGroup: "Chest",
    equipment: "Bodyweight",
    status: "pending",
    sets: [],
  }],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("workout screen scrolling", () => {
  it("keeps the pre-workout top bar outside the scrolling content", () => {
    const { container } = render(<WorkoutStartScreen plan={plan} onBack={vi.fn()} onStart={vi.fn(async () => undefined)} />);
    const scrollRegion = container.querySelector(".workout-scroll");

    expect(scrollRegion).toBeTruthy();
    expect(scrollRegion?.contains(container.querySelector(".workout-top"))).toBe(false);
    expect(scrollRegion?.contains(screen.getByText("First up"))).toBe(true);
  });

  it("keeps the active-workout top bar outside the scrolling content", () => {
    const { container } = render(<WorkoutScreen session={session} onClose={vi.fn()} />);
    const scrollRegion = container.querySelector(".workout-scroll");

    expect(scrollRegion).toBeTruthy();
    expect(scrollRegion?.contains(container.querySelector(".workout-top"))).toBe(false);
    expect(scrollRegion?.contains(screen.getByText("Session log"))).toBe(true);
  });
});
