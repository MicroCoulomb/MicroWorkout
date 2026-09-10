"use client";

import Image from "next/image";
import { ArrowRight, Cloud, CloudOff, Flame, Play, RotateCcw, TimerReset, Users } from "lucide-react";
import { formatDuration, sessionTotals } from "@/domain/metrics";
import type { AppView } from "../micro-workout-app";
import { useWorkoutStore } from "@/features/workouts/workout-store";

export function Dashboard({ onNavigate, onResume }: { onNavigate(view: AppView): void; onResume(): void }) {
  const { sessions, profile, pendingChanges, currentDeviceId, syncStatus, syncNow } = useWorkoutStore();
  const completed = sessions.filter((session) => session.status === "completed" || session.status === "completed_early");
  const active = sessions.find((session) => (session.status === "active" || session.status === "paused") && session.deviceId === currentDeviceId);
  const week = getCurrentWeek();
  const thisWeekSessions = completed.filter((session) => session.endedAt && session.endedAt >= week[0].start && session.endedAt < week[6].end);
  const weeklyGoal = profile?.weeklyGoal ?? 3;
  const lastSession = completed[0];
  const SyncIcon = syncStatus === "synced" ? Cloud : CloudOff;

  return (
    <>
      <header className="topline">
        <div className="brand display"><span>Micro</span>Workout<Image className="brand-mark" src="/icon-orange.png" alt="" width={1536} height={1024} sizes="28px" /></div>
        <button className="sync-pill" onClick={() => void syncNow()}><SyncIcon size={14} /> {syncStatus === "local" ? "Local demo" : syncStatus === "synced" ? "Synced" : syncStatus === "syncing" ? "Syncing" : syncStatus === "offline" ? `${pendingChanges} pending` : syncStatus === "locked" ? "Sign in again" : "Retry sync"}</button>
      </header>
      <div className="page-header dashboard-header"><h1 className="display">Dashboard</h1></div>

      {active && (
        <button className="resume-banner" onClick={onResume}>
          <span className="resume-icon"><RotateCcw /></span>
          <span><small>Workout in progress</small><strong>{active.planName}</strong></span>
          <ArrowRight />
        </button>
      )}

      <section className="dashboard-layout">
        <article className="week-card card">
          <div className="row-between"><div><span className="eyebrow">This week</span><h2 className="display section-title">Your activity</h2></div><strong>{thisWeekSessions.length}/{weeklyGoal}</strong></div>
          <div className="week-row">
            {week.map((day) => {
              const count = completed.filter((session) => session.endedAt && session.endedAt >= day.start && session.endedAt < day.end).length;
              return <div className="day" data-trained={count > 0} key={day.label}><span>{day.short}</span><b>{day.number}</b>{count > 0 && <i>{count}</i>}</div>;
            })}
          </div>
        </article>

        <div className="dashboard-pair">
          <article className="streak-card card">
            <div className="flame"><Flame fill="currentColor" /></div>
            <span className="eyebrow">Week streak</span>
            <div className="streak-number display">{weeklyStreak(completed, weeklyGoal)}</div>
            <div className="goal-bar"><span style={{ width: `${Math.min(100, (thisWeekSessions.length / weeklyGoal) * 100)}%` }} /></div>
          </article>

          <article className="community-card card">
            <div className="community-icon"><Users /></div>
            <span className="eyebrow">Community</span>
            <h2 className="display">Coming soon</h2>
            <p>Share the momentum with your workout circle.</p>
          </article>
        </div>

        <article className="last-card card">
          <div className="row-between"><span className="eyebrow">Latest session</span><button className="history-button" onClick={() => onNavigate("history")}>View history</button></div>
          {lastSession ? <LastSession session={lastSession} /> : <div className="empty-mini"><TimerReset /><p>Your first completed workout will land here.</p></div>}
        </article>
      </section>

      <button className="dashboard-start" onClick={() => onNavigate("plans")} aria-label="Start workout"><Play fill="currentColor" /><span className="sr-only">Start workout</span></button>
    </>
  );
}

function LastSession({ session }: { session: ReturnType<typeof useWorkoutStore>["sessions"][number] }) {
  const totals = sessionTotals(session);
  const completedAt = new Date(session.endedAt ?? session.startedAt);
  return <div className="last-session"><h3 className="display">{session.planName}</h3><div className="last-session-meta"><time dateTime={completedAt.toISOString()}>{completedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><span>{formatDuration(totals.workoutMs)} total</span></div></div>;
}

function getCurrentWeek(reference = new Date()) {
  const start = new Date(reference);
  const day = start.getDay();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const end = new Date(date);
    end.setDate(date.getDate() + 1);
    return { label: date.toISOString(), short: date.toLocaleDateString(undefined, { weekday: "narrow" }), number: date.getDate(), start: date.getTime(), end: end.getTime() };
  });
}

function weeklyStreak(sessions: ReturnType<typeof useWorkoutStore>["sessions"], goal: number) {
  let streak = 0;
  const now = new Date();
  for (let offset = 0; offset < 52; offset++) {
    const reference = new Date(now);
    reference.setDate(now.getDate() - offset * 7);
    const week = getCurrentWeek(reference);
    const count = sessions.filter((session) => session.endedAt && session.endedAt >= week[0].start && session.endedAt < week[6].end).length;
    if (count >= goal) streak += 1;
    else if (offset > 0 || count > 0) break;
  }
  return streak;
}
