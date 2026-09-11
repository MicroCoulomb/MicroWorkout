// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/domain/types";
import { WorkoutStoreProvider, useWorkoutStore } from "./workout-store";

function ProfileName() {
  const { profile } = useWorkoutStore();
  return <span>{profile?.name ?? "Loading"}</span>;
}

function ProfileEditor() {
  const { updateProfile } = useWorkoutStore();
  return <button onClick={() => void updateProfile({ weeklyGoal: 5 })}>Set goal</button>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WorkoutStoreProvider", () => {
  it("initializes its database in React Strict Mode", async () => {
    render(
      <StrictMode>
        <WorkoutStoreProvider userId="strict-mode-test" userName="Athlete" syncEnabled={false}>
          <ProfileName />
        </WorkoutStoreProvider>
      </StrictMode>,
    );

    expect(await screen.findByText("Athlete")).toBeTruthy();
  });

  it("synchronizes newly queued settings without waiting for another login", async () => {
    const profile: UserProfile = {
      id: "profile",
      name: "Athlete",
      weightUnit: "kg",
      weeklyGoal: 3,
      timezone: "Asia/Manila",
      lastVerifiedAt: Date.now(),
    };
    const requests: Array<{ mutations: Array<{ payload?: UserProfile }> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { cursor: number; mutations: Array<{ id: string; payload?: UserProfile }> };
      requests.push(request);
      return new Response(JSON.stringify({
        acceptedIds: request.mutations.map((mutation) => mutation.id),
        changes: [],
        nextCursor: request.cursor,
        serverTime: Date.now(),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    render(
      <WorkoutStoreProvider userId={crypto.randomUUID()} userName="Athlete" syncEnabled initialProfile={profile}>
        <ProfileEditor />
      </WorkoutStoreProvider>,
    );

    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Set goal" }));

    await waitFor(() => expect(requests.some((request) => request.mutations.some((mutation) => mutation.payload?.weeklyGoal === 5))).toBe(true));
  });
});
