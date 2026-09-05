import type { RestState, WorkoutSession } from "./types";

function restDuration(rest: RestState, endedAt: number) {
  if (rest.remainingMs !== undefined) return rest.accumulatedMs;
  return rest.accumulatedMs + Math.max(0, Math.min(endedAt, rest.endsAt) - rest.startedAt);
}

export function completeSessionEarly(session: WorkoutSession, endedAt = Date.now()): WorkoutSession {
  const rest = session.rest;
  const restMs = rest ? restDuration(rest, endedAt) : 0;
  const pausedMs = session.pausedAt ? session.pausedMs + (endedAt - session.pausedAt) : session.pausedMs;

  return {
    ...session,
    status: "completed_early",
    endedAt,
    pausedAt: undefined,
    pausedMs,
    rest: undefined,
    restMs: session.restMs + restMs,
    rests: rest ? [...session.rests, { id: rest.id, setId: rest.setId, startedAt: rest.originalStartedAt, targetEndedAt: rest.endsAt, endedAt, actualMs: restMs, endReason: "finish" }] : session.rests,
    exercises: session.exercises.map((exercise, index) => ({
      ...exercise,
      status: index <= session.currentExerciseIndex && exercise.sets.length ? "completed" : "skipped",
    })),
  };
}
