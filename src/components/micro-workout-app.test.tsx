// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MicroWorkoutApp } from "./micro-workout-app";

const store = vi.hoisted(() => ({
  ready: true,
  sessions: [],
  currentDeviceId: "device",
  startWorkout: vi.fn(),
}));

vi.mock("@/features/workouts/workout-store", () => ({
  WorkoutStoreProvider: ({ children }: { children: ReactNode }) => children,
  useWorkoutStore: () => store,
}));

vi.mock("./screens/dashboard", () => ({ Dashboard: () => <section>Dashboard</section> }));
vi.mock("./screens/history-screen", () => ({ HistoryScreen: () => <section>History</section> }));
vi.mock("./screens/plans-screen", () => ({ PlansScreen: () => <section>Plans</section> }));
vi.mock("./screens/settings-screen", () => ({ SettingsScreen: () => <section>Settings</section> }));
vi.mock("./screens/admin-screen", () => ({ AdminScreen: () => <section>Admin</section> }));
vi.mock("./screens/workout-screen", () => ({ WorkoutScreen: () => <section>Workout</section> }));
vi.mock("./workout-launcher", () => ({
  WorkoutLauncher: ({ onSelect }: { onSelect(plan: { id: string; name: string; restSeconds: number; exerciseIds: string[]; updatedAt: number }): void }) => (
    <button onClick={() => onSelect({ id: "plan", name: "Push", restSeconds: 60, exerciseIds: [], updatedAt: 0 })}>Choose workout</button>
  ),
  WorkoutStartScreen: ({ onBack }: { onBack(): void }) => <button onClick={onBack}>Back to dashboard</button>,
}));

afterEach(() => cleanup());

describe("MicroWorkoutApp viewport shell", () => {
  it("keeps one viewport owner mounted while navigation is hidden for pre-workout", () => {
    const { container } = render(<MicroWorkoutApp />);
    const viewport = container.querySelector(".app-viewport");

    expect(viewport).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Choose workout" }));
    expect(container.querySelector(".app-viewport")).toBe(viewport);
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    expect(container.querySelector(".app-viewport")).toBe(viewport);
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
  });
});
