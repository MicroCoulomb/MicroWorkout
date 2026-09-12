"use client";

import { ChevronLeft, Cloud, CloudOff, Pause, Pencil, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { elapsedWorkoutMs, formatDuration, lbToKg, sessionTotals } from "@/domain/metrics";
import type { RestState, SetLog, WorkoutSession } from "@/domain/types";
import { displayWeight, useWorkoutStore } from "@/features/workouts/workout-store";

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  action(): Promise<void>;
}

export function WorkoutScreen({ session, onClose }: { session: WorkoutSession; onClose(): void }) {
  const store = useWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [confirmation, setConfirmation] = useState<PendingConfirmation>();
  const [editingSet, setEditingSet] = useState<SetLog>();
  const unit = store.profile?.weightUnit ?? "kg";
  const current = session.exercises[session.currentExerciseIndex];
  const remainingRestMs = session.rest ? Math.max(0, session.rest.remainingMs ?? session.rest.endsAt - now) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session.status === "active" && session.rest && now >= session.rest.endsAt) {
      const restMs = currentRestMs(session.rest, session.rest.endsAt);
      void store.saveSession({ ...session, rest: undefined, restMs: session.restMs + restMs, rests: [...session.rests, restLog(session.rest, session.rest.endsAt, restMs, "elapsed")] });
      alertRestFinished();
    }
  }, [now, session, store]);

  async function update(next: WorkoutSession) {
    await store.saveSession(next);
  }

  async function resolveRest(reason: "elapsed" | "skip" | "finish", source = session) {
    if (!source.rest) return source;
    const endedAt = reason === "elapsed" ? source.rest.endsAt : Date.now();
    const restMs = currentRestMs(source.rest, endedAt);
    const next = { ...source, rest: undefined, restMs: source.restMs + restMs, rests: [...source.rests, restLog(source.rest, endedAt, restMs, reason)] };
    await update(next);
    return next;
  }

  async function logSet() {
    const repCount = Number(reps);
    const enteredWeight = Number(weight);
    if (!Number.isInteger(repCount) || repCount < 1 || !current) return;
    if (weight && (!Number.isFinite(enteredWeight) || enteredWeight < 0)) return;
    const weightKg = !weight || enteredWeight === 0 ? null : unit === "kg" ? enteredWeight : lbToKg(enteredWeight);
    const set: SetLog = { id: crypto.randomUUID(), reps: repCount, weightKg, completedAt: Date.now() };
    const exercises = session.exercises.map((exercise, index) => index === session.currentExerciseIndex ? { ...exercise, sets: [...exercise.sets, set] } : exercise);
    const start = Date.now();
    await update({ ...session, exercises, rest: { id: crypto.randomUUID(), setId: set.id, originalStartedAt: start, startedAt: start, endsAt: start + session.restSeconds * 1000, accumulatedMs: 0 } });
    setReps("");
    setWeight("");
  }

  async function extendRest() {
    if (!session.rest || session.status === "paused") return;
    await update({ ...session, rest: { ...session.rest, endsAt: session.rest.endsAt + 10_000 } });
  }

  async function advance(source = session) {
    const exercise = source.exercises[source.currentExerciseIndex];
    const exercises = source.exercises.map((item, index) => index === source.currentExerciseIndex ? { ...item, status: exercise.sets.length ? "completed" as const : "skipped" as const } : item);
    if (source.currentExerciseIndex === source.exercises.length - 1) {
      setConfirmation({ title: "Finish workout?", message: "Completed history cannot be edited.", confirmLabel: "Finish workout", action: () => update({ ...source, exercises, status: "completed", endedAt: Date.now(), rest: undefined }) });
      return;
    }
    await update({ ...source, exercises, currentExerciseIndex: source.currentExerciseIndex + 1, rest: undefined });
  }

  async function finishExercise() {
    await advance(session.rest ? await resolveRest("finish") : session);
  }

  async function togglePause() {
    const at = Date.now();
    if (session.status === "paused") {
      const rest = session.rest?.remainingMs !== undefined ? { ...session.rest, startedAt: at, endsAt: at + session.rest.remainingMs, remainingMs: undefined } : session.rest;
      await update({ ...session, status: "active", pausedMs: session.pausedMs + (at - (session.pausedAt ?? at)), pausedAt: undefined, rest });
      return;
    }
    const rest = session.rest ? { ...session.rest, accumulatedMs: currentRestMs(session.rest, at), remainingMs: Math.max(0, session.rest.endsAt - at), startedAt: 0, endsAt: 0 } : undefined;
    await update({ ...session, status: "paused", pausedAt: at, rest });
  }

  function finishEarly() {
    if (!session.exercises.some((exercise) => exercise.sets.length)) return;
    setConfirmation({ title: "Save workout early?", message: "Remaining exercises will be marked as skipped.", confirmLabel: "Save workout", action: () => store.finishWorkoutEarly(session.id) });
  }

  async function saveEditedSet(set: SetLog, repsValue: string) {
    const parsed = Number(repsValue);
    if (!Number.isInteger(parsed) || parsed < 1) return;
    const exercises = session.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.map((item) => item.id === set.id ? { ...item, reps: parsed } : item) }));
    await update({ ...session, exercises });
    setEditingSet(undefined);
  }

  function deleteSet(set: SetLog) {
    setConfirmation({ title: "Delete set?", message: "This set will be removed from the workout log.", confirmLabel: "Delete set", action: async () => {
      const exercises = session.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.filter((item) => item.id !== set.id) }));
      await update({ ...session, exercises });
    } });
  }

  if (session.status === "completed" || session.status === "completed_early") return <WorkoutSummary session={session} onClose={onClose} />;
  if (!current) return <main className="workout-shell"><p>No exercises are available in this plan.</p><button className="button-secondary" onClick={onClose}>Close</button></main>;

  const restProgress = session.rest ? Math.min(1, remainingRestMs / Math.max(1, session.rest.endsAt - session.rest.startedAt)) : 0;
  return <>
    <main className="workout-shell">
      <header className="workout-top">
        <button className="icon-button" onClick={onClose} aria-label="Minimize workout"><ChevronLeft /></button>
        <div><span>{session.planName}</span><b className="display">{formatDuration(elapsedWorkoutMs(session, now))}</b></div>
        <button className="icon-button" onClick={() => void togglePause()} aria-label={session.status === "paused" ? "Resume workout" : "Pause workout"}>{session.status === "paused" ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}</button>
      </header>

      <div className="workout-scroll">
        <section className="exercise-stage">
          <div className="progress-track"><span style={{ width: String(((session.currentExerciseIndex + 1) / session.exercises.length) * 100) + "%" }} /></div>
          <div className="exercise-counter display">{String(session.currentExerciseIndex + 1).padStart(2, "0")}<small>/{String(session.exercises.length).padStart(2, "0")}</small></div>
          <span className="eyebrow">{current.muscleGroup} · {current.equipment}</span>
          <h1 className="display">{current.name}</h1>
          <p className="muted">Set {current.sets.length + 1}. Keep the movement clean.</p>
        </section>

        {session.status === "paused" ? <section className="pause-panel card"><Pause size={28} /><span className="eyebrow">Timer paused</span><h2 className="display">Take the time you need.</h2><button className="button-primary" onClick={() => void togglePause()}><Play fill="currentColor" /> Resume workout</button></section>
          : session.rest ? <section className="rest-panel">
            <div className="rest-orb" style={{ "--rest-progress": restProgress } as CSSProperties}><span className="eyebrow">Rest interval</span><div className="rest-time display">{formatDuration(remainingRestMs)}</div><p>Next: {current.name}</p></div>
            <button className="add-time" onClick={() => void extendRest()}><Plus size={17} /> +10s</button>
            <div className="rest-actions"><button className="button-secondary" onClick={() => void resolveRest("skip")}><RotateCcw size={18} /> Skip rest</button><button className="button-primary" onClick={() => void finishExercise()}>Finish exercise</button></div>
          </section>
          : <section className="set-entry card"><div className="set-inputs"><label><span>Reps</span><input inputMode="numeric" type="number" min="1" value={reps} onChange={(event) => setReps(event.target.value)} placeholder="12" /></label><label><span>Weight <small>{unit}</small></span><input inputMode="decimal" type="number" min="0" step="0.25" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Optional" /></label></div><button className="set-finished" disabled={!Number.isInteger(Number(reps)) || Number(reps) < 1} onClick={() => void logSet()}>Set finished</button><button className="text-button finish-exercise" onClick={() => void finishExercise()}>{current.sets.length ? "Finish exercise" : "Skip exercise"}</button></section>}

        <section className="live-log">
          <div className="row-between"><span className="eyebrow">Session log</span><button className="danger-link" onClick={() => setConfirmation({ title: "Discard workout?", message: "This active workout and its logged sets will be removed.", confirmLabel: "Discard workout", action: async () => { await store.discardSession(session.id); onClose(); } })}><Trash2 size={15} /> Discard</button></div>
          {session.exercises.filter((exercise) => exercise.sets.length > 0).map((exercise) => <div className="log-exercise" key={exercise.id}><strong>{exercise.name}</strong>{exercise.sets.map((set, index) => <div className="log-set" key={set.id}><span>Set {index + 1}</span><b>{formatSet(set, unit)}</b><div className="log-actions"><button className="log-action" onClick={() => setEditingSet(set)} aria-label={"Edit set " + String(index + 1)}><Pencil size={15} /></button><button className="log-action log-action-danger" onClick={() => deleteSet(set)} aria-label={"Delete set " + String(index + 1)}><Trash2 size={15} /></button></div></div>)}</div>)}
          {session.exercises.some((exercise) => exercise.sets.length) && <button className="button-danger early-finish" onClick={finishEarly}>End workout early</button>}
        </section>
      </div>
    </main>
    {editingSet && <SetEditorDialog set={editingSet} onClose={() => setEditingSet(undefined)} onSave={(repsValue) => void saveEditedSet(editingSet, repsValue)} />}
    {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.confirmLabel} tone="danger" onClose={() => setConfirmation(undefined)} onConfirm={confirmation.action} />}
  </>;
}

function WorkoutSummary({ session, onClose }: { session: WorkoutSession; onClose(): void }) {
  const { profile, pendingChanges, syncStatus } = useWorkoutStore();
  const totals = useMemo(() => sessionTotals(session), [session]);
  const unit = profile?.weightUnit ?? "kg";
  const isSynced = syncStatus === "synced" && pendingChanges === 0;
  const saveLabel = syncStatus === "local" ? "Saved on this device" : isSynced ? "Synced" : "Saved locally";
  return <main className="summary-shell"><span className={`summary-save-status ${isSynced ? "is-synced" : ""}`} aria-live="polite">{isSynced ? <Cloud size={15} /> : <CloudOff size={15} />}{saveLabel}</span><h1 className="display">{session.planName} complete.</h1><div className="summary-grid"><Metric label="Total" value={formatDuration(totals.workoutMs)} /><Metric label="Active" value={formatDuration(totals.activeMs)} /><Metric label="Rest" value={formatDuration(totals.restMs)} /></div><div className="summary-exercises card">{session.exercises.map((exercise) => <div className="summary-row" key={exercise.id}><div><strong>{exercise.name}</strong><span>{exercise.status}</span></div><p>{exercise.sets.length ? exercise.sets.map((set) => formatSet(set, unit)).join(" / ") : "No sets"}</p></div>)}</div><button className="button-primary summary-done" onClick={onClose}>Back to dashboard</button></main>;
}

function SetEditorDialog({ set, onClose, onSave }: { set: SetLog; onClose(): void; onSave(reps: string): void }) {
  const [reps, setReps] = useState(String(set.reps));
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog set-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="set-editor-title"><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><span className="eyebrow">Session log</span><h2 id="set-editor-title" className="display">Edit set</h2><label className="field">Reps<input autoFocus inputMode="numeric" type="number" min="1" value={reps} onChange={(event) => setReps(event.target.value)} /></label><div className="dialog-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!Number.isInteger(Number(reps)) || Number(reps) < 1} onClick={() => onSave(reps)}>Save set</button></div></section></div>;
}

function currentRestMs(rest: RestState, at: number) {
  if (rest.remainingMs !== undefined) return rest.accumulatedMs;
  return rest.accumulatedMs + Math.max(0, Math.min(at, rest.endsAt) - rest.startedAt);
}

function restLog(rest: RestState, endedAt: number, actualMs: number, endReason: "elapsed" | "skip" | "finish") {
  return { id: rest.id, setId: rest.setId, startedAt: rest.originalStartedAt, targetEndedAt: rest.endsAt, endedAt, actualMs, endReason };
}

function formatSet(set: SetLog, unit: "kg" | "lb") {
  if (!set.weightKg) return String(set.reps);
  const weight = displayWeight(set.weightKg, unit);
  const value = Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");
  return String(set.reps) + " (" + value + unit + ")";
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong className="display">{value}</strong></div>; }

function alertRestFinished() {
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    oscillator.connect(audio.destination);
    oscillator.frequency.value = 740;
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.16);
  } catch { }
}
