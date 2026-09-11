// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlansScreen } from "./plans-screen";

const store = vi.hoisted(() => ({
  plans: [
    { id: "push", name: "Push day", exerciseIds: ["push-up", "press"], restSeconds: 60 },
    { id: "pull", name: "Pull day", exerciseIds: ["row"], restSeconds: 45 },
  ],
  exercises: [
    { id: "push-up", name: "Push-up", muscleGroup: "Chest", equipment: "Bodyweight" },
    { id: "press", name: "Dumbbell press", muscleGroup: "Chest", equipment: "Dumbbells" },
    { id: "row", name: "Dumbbell row", muscleGroup: "Back", equipment: "Dumbbells" },
  ],
  copyPreset: vi.fn(async () => undefined),
  duplicatePlan: vi.fn(async () => undefined),
  savePlan: vi.fn(async () => undefined),
  addExercise: vi.fn(async () => "custom"),
  deletePlan: vi.fn(async () => undefined),
}));

vi.mock("@/features/workouts/workout-store", () => ({
  useWorkoutStore: () => store,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("PlansScreen card controls", () => {
  it("keeps the current list in place until another view control completes its click", () => {
    render(<PlansScreen />);

    fireEvent.click(screen.getByRole("button", { name: "View exercises for Push day" }));
    expect(screen.getByText("Push-up")).toBeTruthy();

    const pullViewButton = screen.getByRole("button", { name: "View exercises for Pull day" });
    fireEvent.pointerDown(pullViewButton);
    expect(screen.getByText("Push-up")).toBeTruthy();

    fireEvent.click(pullViewButton);
    expect(screen.queryByText("Push-up")).toBeNull();
    expect(screen.getByText("Dumbbell row")).toBeTruthy();
    expect(pullViewButton.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(pullViewButton);
    expect(pullViewButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Dumbbell row")).toBeNull();

    fireEvent.click(document.body);
    expect(screen.getByRole("button", { name: "View exercises for Pull day" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the plan actions menu outside the card", () => {
    render(<PlansScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Push day" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();

    fireEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("does not focus the plan name when editing an existing plan", () => {
    render(<PlansScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Actions for Push day" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Plan name")).not.toBe(document.activeElement);
  });

  it("searches exercises by name, muscle group, and equipment", () => {
    render(<PlansScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Create new workout plan" }));
    const search = screen.getByLabelText("Search exercises");

    fireEvent.change(search, { target: { value: "chest" } });
    expect(screen.getByText("Push-up")).toBeTruthy();
    expect(screen.getByText("Dumbbell press")).toBeTruthy();

    fireEvent.change(search, { target: { value: "dumbbells" } });
    expect(screen.getByText("Dumbbell row")).toBeTruthy();
  });

  it("opens custom exercise creation on a long press without also opening a plan editor", () => {
    vi.useFakeTimers();
    render(<PlansScreen />);

    const createButton = screen.getByRole("button", { name: "Create new workout plan" });
    fireEvent.pointerDown(createButton, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(createButton, { pointerType: "touch" });
    fireEvent.click(createButton);

    expect(screen.getByRole("heading", { name: "New custom exercise" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New plan" })).toBeNull();
  });

  it("blocks duplicate custom exercises and adds a saved custom exercise to the open plan", async () => {
    render(<PlansScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Create new workout plan" }));
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Custom routine" } });
    fireEvent.click(screen.getByRole("button", { name: "Create custom exercise" }));
    const nameField = screen.getByLabelText("Exercise name");

    fireEvent.change(nameField, { target: { value: " push-up " } });
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));
    expect(screen.getByRole("alert").textContent).toContain("already in your exercise library");
    expect(store.addExercise).not.toHaveBeenCalled();

    fireEvent.change(nameField, { target: { value: " single-arm press " } });
    fireEvent.click(screen.getByRole("button", { name: "Save exercise" }));

    await waitFor(() => expect(store.addExercise).toHaveBeenCalledWith({ name: "Single-Arm Press", muscleGroup: "Chest", equipment: "Bodyweight" }));
    expect(screen.queryByRole("heading", { name: "New custom exercise" })).toBeNull();
    await waitFor(() => expect((screen.getByRole("button", { name: "Save plan" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
