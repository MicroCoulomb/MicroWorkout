// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./settings-screen";

const mocks = vi.hoisted(() => ({
  clearLocalData: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  syncNow: vi.fn(async () => undefined),
  refresh: vi.fn(),
}));

vi.mock("@/features/workouts/workout-store", () => ({
  useWorkoutStore: () => ({
    profile: { id: "profile", name: "Athlete", weeklyGoal: 4, weightUnit: "kg", timezone: "Asia/Manila", lastVerifiedAt: Date.now() },
    pendingChanges: 0,
    updateProfile: vi.fn(async () => undefined),
    clearLocalData: mocks.clearLocalData,
    syncNow: mocks.syncNow,
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
    mocks.refresh.mockClear();
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
});
