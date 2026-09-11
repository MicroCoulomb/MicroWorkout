// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import type { UserProfile } from "@/domain/types";
import { initializeLocalData, MicroWorkoutDatabase } from "./local-db";

const databases: MicroWorkoutDatabase[] = [];

afterEach(async () => {
  for (const db of databases.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe("initializeLocalData", () => {
  it("seeds an authenticated profile without queuing a default profile mutation", async () => {
    const db = new MicroWorkoutDatabase(crypto.randomUUID());
    databases.push(db);
    const initialProfile: UserProfile = {
      id: "profile",
      name: "Rafael",
      weeklyGoal: 5,
      weightUnit: "lb",
      timezone: "Asia/Manila",
      lastVerifiedAt: 1_700_000_000_000,
    };

    await initializeLocalData(db, "Google Name", initialProfile);

    expect(await db.profiles.get("profile")).toEqual(initialProfile);
    expect(await db.outbox.count()).toBe(0);
  });

  it("preserves an existing local profile and its pending changes", async () => {
    const db = new MicroWorkoutDatabase(crypto.randomUUID());
    databases.push(db);
    await initializeLocalData(db, "Local Name");
    const localProfile = await db.profiles.get("profile");
    await db.profiles.put({ ...localProfile!, weeklyGoal: 6 });

    await initializeLocalData(db, "Server Name", {
      ...localProfile!,
      name: "Server Name",
      weeklyGoal: 2,
    });

    expect((await db.profiles.get("profile"))?.weeklyGoal).toBe(6);
  });
});
