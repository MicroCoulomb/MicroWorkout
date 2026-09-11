// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./settings-screen";

const mocks = vi.hoisted(() => ({
  clearLocalData: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  syncNow: vi.fn(),
  refresh: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/features/workouts/workout-store", () => ({
  useWorkoutStore: () => ({
    profile: { id: "profile", name: "Athlete", weeklyGoal: 4, weightUnit: "kg", timezone: "Asia/Manila", lastVerifiedAt: Date.now() },
    pendingChanges: 0,
    updateProfile: vi.fn(async () => undefined),
    clearLocalData: mocks.clearLocalData,
    syncNow: mocks.syncNow,
    syncStatus: "synced",
  }),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: mocks.signOut } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/ui/install-app-card", () => ({ InstallAppCard: () => null }));

describe("SettingsScreen account controls", () => {
  beforeEach(() => {
    mocks.clearLocalData.mockClear();
    mocks.signOut.mockClear();
    mocks.syncNow.mockClear();
    mocks.syncNow.mockResolvedValue({ status: "synced", pendingChanges: 0 });
    mocks.refresh.mockClear();
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue(Response.json([
      { id: "builtin", name: "Push-Up", muscleGroup: "Chest", equipment: "Bodyweight", builtin: true, retiredAt: null },
      { id: "custom", name: "Member Exercise", muscleGroup: "Lats", equipment: "Dumbbells", builtin: false, retiredAt: null },
      { id: "retired", name: "Retired Exercise", muscleGroup: "Abs", equipment: "Bodyweight", builtin: false, retiredAt: "2026-01-01T00:00:00.000Z" },
    ]));
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(cleanup);

  it("keeps the local database when signing out", async () => {
    render(<SettingsScreen isAdmin={false} canDeleteAccount syncEnabled onAdmin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.syncNow).toHaveBeenCalledOnce();
    expect(mocks.clearLocalData).not.toHaveBeenCalled();
  });

  it("clears the local database only through the explicit device action", async () => {
    render(<SettingsScreen isAdmin={false} canDeleteAccount syncEnabled onAdmin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear this device" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear device" }));

    await waitFor(() => expect(mocks.clearLocalData).toHaveBeenCalledOnce());
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("blocks sign out when local changes could not be synchronized", async () => {
    mocks.syncNow.mockResolvedValueOnce({ status: "error", pendingChanges: 1 });
    render(<SettingsScreen isAdmin={false} canDeleteAccount syncEnabled onAdmin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect((await screen.findByRole("alert")).textContent).toContain("1 local change could not sync");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalData).not.toHaveBeenCalled();
  });

  it("opens the complete shared library from owner tools", async () => {
    render(<SettingsScreen isAdmin canDeleteAccount syncEnabled onAdmin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Exercise Library" }));

    expect(await screen.findByRole("dialog", { name: "Edit Exercise Library" })).toBeTruthy();
    expect(await screen.findByText("Push-Up")).toBeTruthy();
    expect(screen.getByText("Retired Exercise")).toBeTruthy();
  });

  it("limits the fix library queue to active custom exercises", async () => {
    render(<SettingsScreen isAdmin canDeleteAccount syncEnabled onAdmin={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Fix Exercise Library" }));

    expect(await screen.findByRole("dialog", { name: "Fix Exercise Library" })).toBeTruthy();
    expect(await screen.findByText("Member Exercise")).toBeTruthy();
    expect(screen.queryByText("Push-Up")).toBeNull();
    expect(screen.queryByText("Retired Exercise")).toBeNull();
  });
});
