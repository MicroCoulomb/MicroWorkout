// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkoutStoreProvider, useWorkoutStore } from "./workout-store";

function ProfileName() {
  const { profile } = useWorkoutStore();
  return <span>{profile?.name ?? "Loading"}</span>;
}

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
});
