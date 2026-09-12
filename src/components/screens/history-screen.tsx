"use client";

import { CalendarDays, CalendarX, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { displayWeight, useWorkoutStore } from "@/features/workouts/workout-store";
import { formatDuration, sessionTotals } from "@/domain/metrics";
import type { WorkoutSession } from "@/domain/types";

const SWIPE_WIDTH = 88;

export function HistoryScreen() {
  const store = useWorkoutStore();
  const [open, setOpen] = useState<string>();
  const [selectedDay, setSelectedDay] = useState<string>();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [revealed, setRevealed] = useState<string>();
  const [drag, setDrag] = useState<{ id: string; offset: number }>();
  const completed = store.sessions.filter(isCompleted);
  const visible = selectedDay ? completed.filter((session) => sessionDay(session) === selectedDay) : completed;

  function changeMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDay(undefined);
    setOpen(undefined);
    setRevealed(undefined);
  }

  return <>
    <header className="page-header"><div><h1 className="page-title">Workout history</h1></div></header>
    <HistoryCalendar month={month} sessions={completed} selectedDay={selectedDay} onPrevious={() => changeMonth(-1)} onNext={() => changeMonth(1)} onSelect={(day) => { setSelectedDay((current) => current === day ? undefined : day); setOpen(undefined); setRevealed(undefined); }} />
    {completed.length === 0 ? <div className="empty-state card"><CalendarX size={42} /><h2 className="display">Nothing logged yet.</h2><p>Complete a workout and its read-only report will appear here.</p></div>
      : visible.length === 0 ? <div className="empty-state card history-filter-empty"><CalendarDays size={42} /><h2 className="display">No workouts this day.</h2><p>Select the date again to see all completed workouts.</p></div>
        : <section className="history-list" aria-label={selectedDay ? `Workout records for ${selectedDay}` : "All workout records"}>{visible.map((session) => <HistoryItem key={session.id} session={session} open={open === session.id} revealed={revealed === session.id} dragOffset={drag?.id === session.id ? drag.offset : undefined} onToggle={() => setOpen(open === session.id ? undefined : session.id)} onReveal={() => setRevealed(session.id)} onClose={() => setRevealed(undefined)} onDrag={(offset) => setDrag({ id: session.id, offset })} onDragEnd={() => setDrag(undefined)} onDelete={() => void store.deleteWorkoutRecord(session.id)} />)}</section>}
  </>;
}

function HistoryCalendar({ month, sessions, selectedDay, onPrevious, onNext, onSelect }: { month: Date; sessions: WorkoutSession[]; selectedDay?: string; onPrevious(): void; onNext(): void; onSelect(day: string): void }) {
  const workoutDays = new Set(sessions.map(sessionDay));
  const today = dayKey(new Date());
  const days = calendarDays(month);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return <section className="history-calendar card" aria-label="Workout calendar">
    <div className="history-calendar-header"><button className="calendar-nav" aria-label="Previous month" onClick={onPrevious}><ChevronLeft size={18} /></button><h2 className="display">{monthLabel}</h2><button className="calendar-nav" aria-label="Next month" onClick={onNext}><ChevronRight size={18} /></button></div>
    <div className="calendar-weekdays" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="calendar-grid">{days.map((day, index) => day ? <button key={day.key} className="calendar-day" data-workout={workoutDays.has(day.key)} data-today={day.key === today} data-selected={day.key === selectedDay} aria-pressed={day.key === selectedDay} aria-label={`${day.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${workoutDays.has(day.key) ? ", workout recorded" : ""}`} onClick={() => onSelect(day.key)}><span>{day.date.getDate()}</span></button> : <span className="calendar-blank" key={`blank-${index}`} />)}</div>
  </section>;
}

function HistoryItem({ session, open, revealed, dragOffset, onToggle, onReveal, onClose, onDrag, onDragEnd, onDelete }: { session: WorkoutSession; open: boolean; revealed: boolean; dragOffset?: number; onToggle(): void; onReveal(): void; onClose(): void; onDrag(offset: number): void; onDragEnd(): void; onDelete(): void }) {
  const { profile } = useWorkoutStore();
  const pointer = useRef<{ id: number; x: number; y: number; offset: number; moved: boolean } | undefined>(undefined);
  const ignoreClick = useRef(false);
  const totals = sessionTotals(session);
  const unit = profile?.weightUnit ?? "kg";
  const offset = dragOffset ?? (revealed ? -SWIPE_WIDTH : 0);

  function pointerDown(event: PointerEvent<HTMLElement>) {
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    const horizontal = event.clientX - current.x;
    const vertical = event.clientY - current.y;
    if (!current.moved && Math.abs(horizontal) < 7) return;
    if (!current.moved && Math.abs(vertical) > Math.abs(horizontal)) return;
    current.moved = true;
    onDrag(Math.max(-SWIPE_WIDTH, Math.min(0, current.offset + horizontal)));
  }

  function pointerEnd(event: PointerEvent<HTMLElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    pointer.current = undefined;
    if (current.moved) {
      const finalOffset = Math.max(-SWIPE_WIDTH, Math.min(0, current.offset + event.clientX - current.x));
      ignoreClick.current = true;
      if (finalOffset < -SWIPE_WIDTH / 2) onReveal();
      else onClose();
    }
    onDragEnd();
  }

  return <div className="history-swipe-row">
    <button className="history-delete" aria-label={`Delete ${session.planName} workout record`} aria-hidden={!revealed} tabIndex={revealed ? 0 : -1} onClick={onDelete}><Trash2 size={21} /></button>
    <article className="history-card card" data-dragging={dragOffset !== undefined} style={{ transform: `translateX(${offset}px)` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      <button className="history-head" aria-expanded={open} onClick={() => { if (ignoreClick.current) { ignoreClick.current = false; return; } if (revealed) { onClose(); return; } onToggle(); }}><time dateTime={new Date(session.endedAt ?? session.startedAt).toISOString()}>{new Date(session.endedAt ?? session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><div><h2 className="display">{session.planName}</h2><p>{totals.exercises} exercise{totals.exercises === 1 ? "" : "s"} · {formatDuration(totals.activeMs)} active</p></div><ChevronDown data-open={open} /></button>
      {open && <div className="history-detail"><div className="history-metrics"><span><b>{formatDuration(totals.activeMs)}</b> active</span><span><b>{formatDuration(totals.restMs)}</b> rest</span></div>{session.exercises.map((exercise) => <div className="history-exercise" key={exercise.id}><div><strong>{exercise.name}</strong><small>{exercise.status}</small></div><p>{exercise.sets.length ? exercise.sets.map((set, index) => <span className="history-set" key={set.id}><b>S{index + 1}</b> {set.reps} reps{set.weightKg ? ` @ ${displayWeight(set.weightKg, unit).toFixed(1)} ${unit}` : ""}</span>) : "No sets"}</p></div>)}</div>}
    </article>
  </div>;
}

function isCompleted(session: WorkoutSession) {
  return session.status === "completed" || session.status === "completed_early";
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sessionDay(session: WorkoutSession) {
  return dayKey(new Date(session.endedAt ?? session.startedAt));
}

function calendarDays(month: Date) {
  const firstWeekday = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + count) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > count) return undefined;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return { date, key: dayKey(date) };
  });
}
