"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PRESET_PLANS } from "@/domain/presets";
import { completeSessionEarly } from "@/domain/session-completion";
import type { Exercise, UserProfile, WeightUnit, WorkoutPlan, WorkoutSession } from "@/domain/types";
import { deviceId, initializeLocalData, MicroWorkoutDatabase, queueMutation } from "@/lib/local-db";
import { SyncRejectedError, synchronizeLocalData } from "@/lib/sync-client";

export type SyncStatus = "local" | "synced" | "syncing" | "offline" | "error" | "locked";

export interface SyncResult {
  status: SyncStatus;
  pendingChanges: number;
}

interface StoreValue {
  ready: boolean;
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  profile?: UserProfile;
  pendingChanges: number;
  currentDeviceId: string;
  syncStatus: SyncStatus;
  syncNow(): Promise<SyncResult>;
  savePlan(plan: Pick<WorkoutPlan, "id" | "name" | "restSeconds" | "exerciseIds">): Promise<void>;
  copyPreset(index: number): Promise<string>;
  duplicatePlan(plan: WorkoutPlan): Promise<void>;
  deletePlan(id: string): Promise<void>;
  addExercise(exercise: Omit<Exercise, "id" | "builtin" | "updatedAt">): Promise<string>;
  updateProfile(changes: Partial<Pick<UserProfile, "name" | "weeklyGoal" | "weightUnit">>): Promise<void>;
  startWorkout(plan: WorkoutPlan): Promise<string>;
  saveSession(session: WorkoutSession): Promise<void>;
  discardSession(id: string): Promise<void>;
  deleteWorkoutRecord(id: string): Promise<void>;
  finishWorkoutEarly(id: string): Promise<void>;
  clearLocalData(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function WorkoutStoreProvider({ children, userId, userName, syncEnabled, initialProfile }: { children: ReactNode; userId: string; userName: string; syncEnabled: boolean; initialProfile?: UserProfile }) {
  const localDb = useMemo(() => new MicroWorkoutDatabase(userId), [userId]);
  const currentDeviceId = useMemo(() => deviceId(userId), [userId]);
  const exercises = useLiveQuery(() => localDb.exercises.orderBy("name").toArray(), [localDb]) ?? [];
  const plans = useLiveQuery(() => localDb.plans.orderBy("updatedAt").reverse().toArray(), [localDb]) ?? [];
  const sessions = useLiveQuery(() => localDb.sessions.orderBy("startedAt").reverse().toArray(), [localDb]) ?? [];
  const profile = useLiveQuery(() => localDb.profiles.get("profile"), [localDb]);
  const pendingChanges = useLiveQuery(() => localDb.outbox.count(), [localDb]) ?? 0;
  const [syncStatus, setSyncStatus] = useState<StoreValue["syncStatus"]>(syncEnabled ? "syncing" : "local");
  const activeSync = useRef<Promise<SyncResult> | undefined>(undefined);

  useEffect(() => {
    void initializeLocalData(localDb, userName, initialProfile);
    return () => localDb.close({ disableAutoOpen: false });
  }, [initialProfile, localDb, userName]);

  const clearDatabase = useCallback(async () => {
    await localDb.transaction("rw", [localDb.plans, localDb.sessions, localDb.exercises, localDb.profiles, localDb.outbox, localDb.syncMeta], async () => {
      await Promise.all([localDb.plans.clear(), localDb.sessions.clear(), localDb.exercises.clear(), localDb.profiles.clear(), localDb.outbox.clear(), localDb.syncMeta.clear()]);
    });
  }, [localDb]);

  const performSync = useCallback(async (): Promise<SyncResult> => {
    if (!syncEnabled) return { status: "local", pendingChanges: await localDb.outbox.count() };
    if (!navigator.onLine) {
      const result = { status: "offline" as const, pendingChanges: await localDb.outbox.count() };
      setSyncStatus(result.status);
      return result;
    }
    setSyncStatus("syncing");
    try {
      await synchronizeLocalData(localDb);
      const result = { status: "synced" as const, pendingChanges: await localDb.outbox.count() };
      setSyncStatus(result.status);
      return result;
    }
    catch (error) {
      const status = error instanceof SyncRejectedError ? "locked" as const : "error" as const;
      const result = { status, pendingChanges: await localDb.outbox.count() };
      setSyncStatus(status);
      return result;
    }
  }, [localDb, syncEnabled]);

  const syncNow = useCallback(() => {
    if (activeSync.current) return activeSync.current;
    const operation = performSync();
    activeSync.current = operation;
    void operation.then(
      () => { if (activeSync.current === operation) activeSync.current = undefined; },
      () => { if (activeSync.current === operation) activeSync.current = undefined; },
    );
    return operation;
  }, [performSync]);

  useEffect(() => {
    if (!syncEnabled) return;
    const initialSync = window.setTimeout(() => void syncNow(), 0);
    const online = () => void syncNow();
    const offline = () => setSyncStatus("offline");
    const visible = () => document.visibilityState === "visible" && void syncNow();
    window.addEventListener("online", online); window.addEventListener("offline", offline); document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(initialSync); window.removeEventListener("online", online); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", visible); };
  }, [syncEnabled, syncNow]);

  useEffect(() => {
    if (!syncEnabled || pendingChanges === 0 || syncStatus !== "synced" || !navigator.onLine) return;
    const pendingSync = window.setTimeout(() => void syncNow(), 0);
    return () => window.clearTimeout(pendingSync);
  }, [pendingChanges, syncEnabled, syncNow, syncStatus]);

  async function savePlan(input: Pick<WorkoutPlan, "id" | "name" | "restSeconds" | "exerciseIds">) {
    const aliases = await localDb.exerciseAliases.bulkGet(input.exerciseIds);
    const canonicalIds = input.exerciseIds.map((id, index) => aliases[index]?.canonicalId ?? id);
    const plan = { ...input, exerciseIds: canonicalIds, name: input.name.trim(), updatedAt: Date.now() };
    await localDb.transaction("rw", localDb.plans, localDb.outbox, async () => {
      await localDb.plans.put(plan);
      await queueMutation(localDb, { entityType: "plan", entityId: plan.id, operation: "upsert", payload: plan });
    });
  }

  async function copyPreset(index: number) {
    const preset = PRESET_PLANS[index];
    const id = crypto.randomUUID();
    await savePlan({ id, ...preset });
    return id;
  }

  async function duplicatePlan(source: WorkoutPlan) {
    await savePlan({
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      restSeconds: source.restSeconds,
      exerciseIds: [...source.exerciseIds],
    });
  }

  async function deletePlan(id: string) {
    await localDb.transaction("rw", localDb.plans, localDb.outbox, async () => {
      await localDb.plans.delete(id);
      await queueMutation(localDb, { entityType: "plan", entityId: id, operation: "delete" });
    });
  }

  async function addExercise(input: Omit<Exercise, "id" | "builtin" | "updatedAt">) {
    const exercise: Exercise = {
      ...input,
      id: crypto.randomUUID(),
      builtin: false,
      name: input.name.trim(),
      updatedAt: Date.now(),
    };
    await localDb.transaction("rw", localDb.exercises, localDb.outbox, async () => {
      await localDb.exercises.add(exercise);
      await queueMutation(localDb, { entityType: "exercise", entityId: exercise.id, operation: "upsert", payload: exercise });
    });
    return exercise.id;
  }

  async function updateProfile(changes: Partial<Pick<UserProfile, "name" | "weeklyGoal" | "weightUnit">>) {
    const current = await localDb.profiles.get("profile");
    if (!current) return;
    const next = { ...current, ...changes };
    await localDb.transaction("rw", localDb.profiles, localDb.outbox, async () => {
      await localDb.profiles.put(next);
      await queueMutation(localDb, { entityType: "profile", entityId: "profile", operation: "upsert", payload: next });
    });
  }

  async function startWorkout(plan: WorkoutPlan) {
    const exercisesById = new Map((await localDb.exercises.bulkGet([...new Set(plan.exerciseIds)])).filter((item): item is Exercise => Boolean(item)).map((exercise) => [exercise.id, exercise]));
    const now = Date.now();
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      deviceId: currentDeviceId,
      planId: plan.id,
      planName: plan.name,
      restSeconds: plan.restSeconds,
      status: "active",
      currentExerciseIndex: 0,
      startedAt: now,
      pausedMs: 0,
      restMs: 0,
      rests: [],
      updatedAt: now,
      exercises: plan.exerciseIds.map((id) => exercisesById.get(id)).filter((item): item is Exercise => Boolean(item)).map((exercise) => ({
        id: crypto.randomUUID(),
        sourceExerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        status: "pending",
        sets: [],
      })),
    };
    await saveSession(session);
    return session.id;
  }

  async function saveSession(session: WorkoutSession) {
    const next = { ...session, updatedAt: Date.now() };
    await localDb.transaction("rw", localDb.sessions, localDb.outbox, async () => {
      await localDb.sessions.put(next);
      await queueMutation(localDb, { entityType: "session", entityId: next.id, operation: "upsert", payload: next });
    });
  }

  async function discardSession(id: string) {
    await localDb.transaction("rw", localDb.sessions, localDb.outbox, async () => {
      await localDb.sessions.delete(id);
      await queueMutation(localDb, { entityType: "session", entityId: id, operation: "delete" });
    });
  }

  async function deleteWorkoutRecord(id: string) {
    const session = await localDb.sessions.get(id);
    if (!session || (session.status !== "completed" && session.status !== "completed_early")) return;
    await localDb.transaction("rw", localDb.sessions, localDb.outbox, async () => {
      await localDb.sessions.delete(id);
      await queueMutation(localDb, { entityType: "session", entityId: id, operation: "delete" });
    });
  }

  async function finishWorkoutEarly(id: string) {
    await localDb.transaction("rw", localDb.sessions, localDb.outbox, async () => {
      const session = await localDb.sessions.get(id);
      if (!session || (session.status !== "active" && session.status !== "paused")) return;
      const completed = { ...completeSessionEarly(session), updatedAt: Date.now() };
      await localDb.sessions.put(completed);
      await queueMutation(localDb, { entityType: "session", entityId: completed.id, operation: "upsert", payload: completed });
    });
  }

  async function clearLocalData() {
    await clearDatabase();
  }

  return (
    <StoreContext.Provider value={{
      ready: Boolean(profile), exercises, plans, sessions, profile, pendingChanges, currentDeviceId, syncStatus, syncNow,
      savePlan, copyPreset, duplicatePlan, deletePlan, addExercise, updateProfile,
      startWorkout, saveSession, discardSession, deleteWorkoutRecord, finishWorkoutEarly, clearLocalData,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useWorkoutStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useWorkoutStore must be used within WorkoutStoreProvider");
  return context;
}

export function displayWeight(kg: number, unit: WeightUnit) {
  return unit === "kg" ? kg : kg * 2.2046226218;
}
