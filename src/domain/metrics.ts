import type { WorkoutSession } from "./types";

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function elapsedWorkoutMs(session: WorkoutSession, now = Date.now()) {
  const end = session.endedAt ?? session.pausedAt ?? now;
  return Math.max(0, end - session.startedAt - session.pausedMs);
}

export function sessionTotals(session: WorkoutSession) {
  const sets = session.exercises.flatMap((exercise) => exercise.sets);
  return {
    exercises: session.exercises.filter((exercise) => exercise.status === "completed").length,
    sets: sets.length,
    reps: sets.reduce((total, set) => total + set.reps, 0),
    volumeKg: sets.reduce((total, set) => total + (set.weightKg ?? 0) * set.reps, 0),
    workoutMs: elapsedWorkoutMs(session, session.endedAt),
    restMs: session.restMs,
    activeMs: Math.max(0, elapsedWorkoutMs(session, session.endedAt) - session.restMs),
  };
}

export function kgToLb(kg: number) {
  return kg * 2.2046226218;
}

export function lbToKg(lb: number) {
  return lb / 2.2046226218;
}
