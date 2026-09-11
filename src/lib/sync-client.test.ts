// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutboxMutation, WorkoutSession } from "@/domain/types";
import { MicroWorkoutDatabase } from "./local-db";
import { SyncRejectedError, synchronizeExerciseCatalog, synchronizeLocalData } from "./sync-client";

const databases: MicroWorkoutDatabase[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("synchronizeLocalData", () => {
  it("uploads pending mutations in API-sized batches", async () => {
    const database = createDatabase();
    await database.outbox.bulkAdd(Array.from({ length: 251 }, (_, index) => mutation(index)));
    const batchSizes: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init) return Response.json({ exercises: [], aliases: [] });
      const request = JSON.parse(String(init?.body)) as { cursor: number; mutations: OutboxMutation[] };
      batchSizes.push(request.mutations.length);
      return Response.json({ acceptedIds: request.mutations.map(({ id }) => id), changes: [], nextCursor: request.cursor, hasMore: false, serverTime: Date.now() });
    }));

    await synchronizeLocalData(database);

    expect(batchSizes).toEqual([250, 1]);
    expect(await database.outbox.count()).toBe(0);
  });

  it("downloads every page of server changes", async () => {
    const database = createDatabase();
    const cursors: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init) return Response.json({ exercises: [], aliases: [] });
      const request = JSON.parse(String(init?.body)) as { cursor: number };
      cursors.push(request.cursor);
      return Response.json({ acceptedIds: [], changes: [], nextCursor: request.cursor === 0 ? 500 : 501, hasMore: request.cursor === 0, serverTime: Date.now() });
    }));

    await synchronizeLocalData(database);

    expect(cursors).toEqual([0, 500]);
    expect((await database.syncMeta.get("sync"))?.cursor).toBe(501);
  });

  it("keeps local records and queued changes when authentication is rejected", async () => {
    const database = createDatabase();
    const session = workoutSession(2);
    await database.sessions.put(session);
    await database.outbox.put(mutation(1, session));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    await expect(synchronizeLocalData(database)).rejects.toBeInstanceOf(SyncRejectedError);

    expect(await database.sessions.get(session.id)).toEqual(session);
    expect(await database.outbox.count()).toBe(1);
  });

  it("does not overwrite a newer mutation queued while a sync request is in flight", async () => {
    const database = createDatabase();
    const oldSession = workoutSession(1);
    const newSession = workoutSession(2);
    await database.sessions.put(oldSession);
    let releaseFirstRequest!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => { releaseFirstRequest = resolve; });
    let requestCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestCount += 1;
      if (requestCount === 1) return firstResponse;
      if (!init) return Response.json({ exercises: [], aliases: [] });
      const request = JSON.parse(String(init?.body)) as { cursor: number; mutations: OutboxMutation[] };
      return Response.json({
        acceptedIds: request.mutations.map(({ id }) => id),
        changes: [{ cursor: 2, entityType: "session", entityId: oldSession.id, operation: "upsert", payload: oldSession }],
        nextCursor: 2,
        hasMore: false,
        serverTime: Date.now(),
      });
    }));

    const syncing = synchronizeLocalData(database);
    await database.transaction("rw", [database.sessions, database.outbox], async () => {
      await database.sessions.put(newSession);
      await database.outbox.put(mutation(2, newSession));
    });
    releaseFirstRequest(Response.json({
      acceptedIds: [],
      changes: [{ cursor: 1, entityType: "session", entityId: oldSession.id, operation: "upsert", payload: oldSession }],
      nextCursor: 1,
      hasMore: false,
      serverTime: Date.now(),
    }));
    await syncing;

    expect((await database.sessions.get(oldSession.id))?.updatedAt).toBe(2);
    expect(await database.outbox.count()).toBe(0);
  });

  it("rewrites local plans when the shared catalog resolves an exercise alias", async () => {
    const database = createDatabase();
    const plan = { id: "plan-1", name: "Shared routine", restSeconds: 60, exerciseIds: ["old-exercise"], updatedAt: 1 };
    await database.plans.put(plan);
    await database.outbox.put({ id: "plan-mutation", entityType: "plan", entityId: plan.id, operation: "upsert", payload: plan, createdAt: 1 });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      exercises: [{ id: "new-exercise", name: "Custom Press", muscleGroup: "Chest", equipment: "Dumbbells", builtin: false, updatedAt: 2 }],
      aliases: [{ id: "old-exercise", canonicalId: "new-exercise" }],
    })));

    await synchronizeExerciseCatalog(database);

    expect((await database.plans.get(plan.id))?.exerciseIds).toEqual(["new-exercise"]);
    expect(((await database.outbox.get("plan-mutation"))?.payload as typeof plan).exerciseIds).toEqual(["new-exercise"]);
  });
});

function createDatabase() {
  const database = new MicroWorkoutDatabase(`sync-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

function mutation(index: number, payload?: WorkoutSession): OutboxMutation {
  return {
    id: `mutation-${index}`,
    entityType: payload ? "session" : "profile",
    entityId: payload?.id ?? "profile",
    operation: "upsert",
    payload,
    createdAt: index,
  };
}

function workoutSession(updatedAt: number): WorkoutSession {
  return {
    id: "session-1",
    deviceId: "device-1",
    planId: "plan-1",
    planName: "Workout",
    restSeconds: 60,
    status: "completed",
    exercises: [],
    currentExerciseIndex: 0,
    startedAt: 1,
    endedAt: 2,
    pausedMs: 0,
    restMs: 0,
    rests: [],
    updatedAt,
  };
}
