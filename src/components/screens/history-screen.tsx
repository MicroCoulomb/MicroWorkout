"use client";

import { CalendarX, ChevronDown } from "lucide-react";
import { useState } from "react";
import { displayWeight, useWorkoutStore } from "@/features/workouts/workout-store";
import { formatDuration, sessionTotals } from "@/domain/metrics";
import type { WorkoutSession } from "@/domain/types";

export function HistoryScreen() {
  const store = useWorkoutStore();
  const [open, setOpen] = useState<string>();
  const completed = store.sessions.filter((session) => session.status === "completed" || session.status === "completed_early");
  return <>
    <header className="page-header"><div><span className="eyebrow">Permanent record</span><h1 className="display">Workout<br />history</h1></div></header>
    {completed.length === 0 ? <div className="empty-state card"><CalendarX size={42} /><h2 className="display">Nothing logged yet.</h2><p>Complete a workout and its read-only report will appear here.</p></div>
      : <section className="history-list">{completed.map((session) => <HistoryItem key={session.id} session={session} open={open === session.id} onToggle={() => setOpen(open === session.id ? undefined : session.id)} />)}</section>}
  </>;
}

function HistoryItem({ session, open, onToggle }: { session: WorkoutSession; open: boolean; onToggle(): void }) {
  const { profile } = useWorkoutStore();
  const totals = sessionTotals(session);
  const unit = profile?.weightUnit ?? "kg";
  return <article className="history-card card">
    <button className="history-head" onClick={onToggle}><time>{new Date(session.endedAt ?? session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><div><h2 className="display">{session.planName}</h2><p>{totals.sets} sets · {totals.reps} reps · {formatDuration(totals.workoutMs)}</p></div><ChevronDown data-open={open} /></button>
    {open && <div className="history-detail"><div className="history-metrics"><span><b>{formatDuration(totals.activeMs)}</b> active</span><span><b>{formatDuration(totals.restMs)}</b> rest</span><span><b>{(unit === "kg" ? totals.volumeKg : displayWeight(totals.volumeKg, "lb")).toFixed(0)} {unit}</b> volume</span></div>{session.exercises.map((exercise) => <div className="history-exercise" key={exercise.id}><div><strong>{exercise.name}</strong><small>{exercise.status}</small></div><p>{exercise.sets.length ? exercise.sets.map((set, index) => `S${index + 1} ${set.reps} reps${set.weightKg ? ` @ ${displayWeight(set.weightKg, unit).toFixed(1)} ${unit}` : ""}`).join(" · ") : "No sets"}</p></div>)}</div>}
  </article>;
}
