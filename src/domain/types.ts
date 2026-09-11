export type WeightUnit = "kg" | "lb";
export const MUSCLE_GROUPS = ["Chest", "Front Delts", "Side Delts", "Rear Delts", "Triceps", "Lats", "Traps", "Biceps", "Forearms", "Quads", "Glutes", "Hamstrings", "Calves", "Abs", "Obliques", "Lower back"] as const;
export type MuscleGroup = typeof MUSCLE_GROUPS[number];
export type Equipment = "Bodyweight" | "Dumbbells";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  builtin: boolean;
  updatedAt: number;
  retiredAt?: number;
}

export interface ExerciseAlias {
  id: string;
  canonicalId: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  restSeconds: number;
  exerciseIds: string[];
  updatedAt: number;
}

export interface SetLog {
  id: string;
  reps: number;
  weightKg: number | null;
  completedAt: number;
}

export type SessionExerciseStatus = "pending" | "completed" | "skipped";

export interface SessionExercise {
  id: string;
  sourceExerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  status: SessionExerciseStatus;
  sets: SetLog[];
}

export interface RestState {
  id: string;
  setId: string;
  originalStartedAt: number;
  startedAt: number;
  endsAt: number;
  accumulatedMs: number;
  remainingMs?: number;
}

export interface RestLog {
  id: string;
  setId: string;
  startedAt: number;
  targetEndedAt: number;
  endedAt: number;
  actualMs: number;
  endReason: "elapsed" | "skip" | "finish";
}

export type SessionStatus = "active" | "paused" | "completed" | "completed_early";

export interface WorkoutSession {
  id: string;
  deviceId: string;
  planId: string;
  planName: string;
  restSeconds: number;
  status: SessionStatus;
  exercises: SessionExercise[];
  currentExerciseIndex: number;
  startedAt: number;
  endedAt?: number;
  pausedAt?: number;
  pausedMs: number;
  restMs: number;
  rests: RestLog[];
  rest?: RestState;
  updatedAt: number;
}

export interface UserProfile {
  id: "profile";
  name: string;
  weightUnit: WeightUnit;
  weeklyGoal: number;
  timezone: string;
  lastVerifiedAt: number;
}

export interface OutboxMutation {
  id: string;
  entityType: "plan" | "exercise" | "session" | "profile";
  entityId: string;
  operation: "upsert" | "delete";
  payload?: unknown;
  createdAt: number;
}

export interface SyncMeta {
  id: "sync";
  cursor: number;
  lastSyncedAt?: number;
}
