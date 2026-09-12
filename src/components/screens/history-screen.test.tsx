// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutSession } from "@/domain/types";
import { HistoryScreen } from "./history-screen";

const workoutDay = new Date(2026, 8, 12, 10).getTime();
const otherDay = new Date(2026, 8, 13, 10).getTime();
const store = vi.hoisted(() => ({
  profile: { weightUnit: "kg" },
  deleteWorkoutRecord: vi.fn(async () => undefined),
  sessions: [] as WorkoutSession[],
}));

vi.mock("@/features/workouts/workout-store", () => ({
  displayWeight: (value: number) => value,
  useWorkoutStore: () => store,
}));

function session(id: string, startedAt: number): WorkoutSession {
  return {
    id,
    deviceId: "device",
    planId: "plan",
    planName: id === "push" ? "Push day" : "Pull day",
    restSeconds: 60,
    status: "completed" as const,
    currentExerciseIndex: 0,
    startedAt,
    endedAt: startedAt + 600_000,
    pausedMs: 0,
    restMs: 120_000,
    rests: [],
    updatedAt: startedAt + 600_000,
    exercises: [{ id: `${id}-exercise`, name: "Dumbbell incline press with a deliberately long name", status: "completed" as const, sets: [{ id: `${id}-set-1`, reps: 10, weightKg: 12.5, completedAt: startedAt + 1 }], muscleGroup: "Chest" as const, equipment: "Dumbbells" as const, sourceExerciseId: "press" }],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  store.sessions = [];
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 12, 12));
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

describe("HistoryScreen", () => {
  it("fills its fixed calendar height with the displayed month's week rows", () => {
    store.sessions = [session("push", workoutDay)];
    const { container } = render(<HistoryScreen />);
    const grid = container.querySelector(".calendar-grid") as HTMLElement;

    expect(grid.style.getPropertyValue("--calendar-rows")).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(grid.style.getPropertyValue("--calendar-rows")).toBe("6");

    for (let index = 0; index < 6; index += 1) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(grid.style.getPropertyValue("--calendar-rows")).toBe("4");
  });

  it("shows exercise count and active time, then filters records by selected calendar day", () => {
    store.sessions = [session("push", workoutDay), session("pull", otherDay)];
    render(<HistoryScreen />);

    expect(screen.getByRole("region", { name: "All workout records" }).parentElement?.className).toBe("history-records");
    expect(screen.getAllByText("1 exercise · 08:00 active")).toHaveLength(2);
    const calendarDay = screen.getByRole("button", { name: /Saturday, September 12, 2026, workout recorded/ });
    expect(calendarDay.querySelector("i")).toBeNull();
    fireEvent.click(calendarDay);

    expect(screen.getByText("Push day")).toBeTruthy();
    expect(screen.queryByText("Pull day")).toBeNull();
    fireEvent.click(calendarDay);
    expect(calendarDay.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Pull day")).toBeTruthy();
  });

  it("keeps each expanded set together and reveals deletion after a left swipe", () => {
    store.sessions = [session("push", workoutDay)];
    render(<HistoryScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Sep 12, 2026.*Push day/ }));
    const setNumber = screen.getByText("S1");
    expect(setNumber.tagName).toBe("B");
    expect(setNumber.parentElement?.className).toBe("history-set");
    expect(screen.queryByText(/volume/i)).toBeNull();

    const card = screen.getByText("Push day").closest("article")!;
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 180, clientY: 0 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 70, clientY: 0 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 70, clientY: 0 });
    expect(card.style.transform).toBe("translateX(-88px)");

    fireEvent.pointerDown(document.body);
    expect(card.style.transform).toBe("translateX(0px)");

    fireEvent.pointerDown(card, { pointerId: 2, clientX: 180, clientY: 0 });
    fireEvent.pointerMove(card, { pointerId: 2, clientX: 70, clientY: 0 });
    fireEvent.pointerUp(card, { pointerId: 2, clientX: 70, clientY: 0 });
    expect(card.style.transform).toBe("translateX(-88px)");

    fireEvent.click(screen.getByRole("button", { name: "Delete Push day workout record" }));
    expect(store.deleteWorkoutRecord).toHaveBeenCalledWith("push");
  });
});
