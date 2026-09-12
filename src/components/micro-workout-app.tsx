"use client";

import { CalendarDays, Dumbbell, Home, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./screens/dashboard";
import { HistoryScreen } from "./screens/history-screen";
import { PlansScreen } from "./screens/plans-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { AdminScreen } from "./screens/admin-screen";
import { WorkoutScreen } from "./screens/workout-screen";
import { WorkoutLauncher, WorkoutStartScreen } from "./workout-launcher";
import { WorkoutStoreProvider, useWorkoutStore } from "@/features/workouts/workout-store";
import type { UserProfile, WorkoutPlan } from "@/domain/types";

export type AppView = "home" | "plans" | "history" | "settings" | "admin";

export function MicroWorkoutApp({ userId = "demo", userName = "Athlete", syncEnabled = false, isAdmin = false, canDeleteAccount = true, initialProfile }: { userId?: string; userName?: string; syncEnabled?: boolean; isAdmin?: boolean; canDeleteAccount?: boolean; initialProfile?: UserProfile }) {
  useEffect(() => {
    if (syncEnabled && navigator.onLine) window.localStorage.setItem("microworkout-last-user", JSON.stringify({ id: userId, name: userName, verifiedAt: Date.now() }));
  }, [syncEnabled, userId, userName]);
  return (
    <WorkoutStoreProvider userId={userId} userName={userName} syncEnabled={syncEnabled} initialProfile={initialProfile}>
      <AppContent isAdmin={isAdmin} canDeleteAccount={canDeleteAccount} syncEnabled={syncEnabled} />
    </WorkoutStoreProvider>
  );
}

function AppContent({ isAdmin, canDeleteAccount, syncEnabled }: { isAdmin: boolean; canDeleteAccount: boolean; syncEnabled: boolean }) {
  const [view, setView] = useState<AppView>("home");
  const [workoutId, setWorkoutId] = useState<string>();
  const [pendingPlan, setPendingPlan] = useState<WorkoutPlan>();
  const { ready, sessions, currentDeviceId, startWorkout } = useWorkoutStore();
  const appFrameRef = useRef<HTMLElement | null>(null);
  const activeSession = typeof window === "undefined" ? undefined : sessions.find(
    (session) => (session.status === "active" || session.status === "paused") && session.deviceId === currentDeviceId,
  );
  const selectedSession = workoutId ? sessions.find((session) => session.id === workoutId) : undefined;
  const appShellVisible = ready && !selectedSession && !pendingPlan;

  useEffect(() => {
    if (!appShellVisible) return;
    document.body.classList.add("app-active");
    return () => document.body.classList.remove("app-active");
  }, [appShellVisible]);

  useEffect(() => {
    if (!appShellVisible) return;
    const frame = appFrameRef.current;
    if (!frame) return;
    let touchY: number | undefined;
    const start = (event: TouchEvent) => { touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined; };
    const move = (event: TouchEvent) => {
      if (touchY === undefined || event.touches.length !== 1) return;
      if (event.target instanceof Element && event.target.closest(".dialog, [data-scroll-lock-exempt]")) return;
      const nextY = event.touches[0].clientY;
      const deltaY = nextY - touchY;
      const atTop = frame.scrollTop <= 0;
      const atBottom = frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 1;
      if ((deltaY > 0 && atTop) || (deltaY < 0 && atBottom)) event.preventDefault();
      touchY = nextY;
    };
    const end = () => { touchY = undefined; };
    frame.addEventListener("touchstart", start, { passive: true });
    frame.addEventListener("touchmove", move, { passive: false });
    frame.addEventListener("touchend", end, { passive: true });
    frame.addEventListener("touchcancel", end, { passive: true });
    return () => {
      frame.removeEventListener("touchstart", start);
      frame.removeEventListener("touchmove", move);
      frame.removeEventListener("touchend", end);
      frame.removeEventListener("touchcancel", end);
    };
  }, [appShellVisible]);

  if (!ready) {
    return <main className="app-frame"><div className="loading-mark display">MW</div></main>;
  }

  if (selectedSession) {
    return <WorkoutScreen session={selectedSession} onClose={() => { setWorkoutId(undefined); setView("home"); }} />;
  }

  if (pendingPlan) {
    return <WorkoutStartScreen plan={pendingPlan} onBack={() => setPendingPlan(undefined)} onStart={async () => {
      const id = await startWorkout(pendingPlan);
      setPendingPlan(undefined);
      setWorkoutId(id);
    }} />;
  }

  const showLauncher = view === "home" || view === "plans" || view === "history";

  return (
    <main ref={appFrameRef} className={`app-frame${view === "history" ? " app-frame-history" : ""}`}>
      {view === "home" && <Dashboard onNavigate={setView} onResume={() => activeSession && setWorkoutId(activeSession.id)} />}
      {view === "plans" && <PlansScreen />}
      {view === "history" && <HistoryScreen />}
      {view === "settings" && <SettingsScreen isAdmin={isAdmin} canDeleteAccount={canDeleteAccount} syncEnabled={syncEnabled} onAdmin={() => setView("admin")} />}
      {view === "admin" && <AdminScreen onBack={() => setView("settings")} />}
      {showLauncher && <WorkoutLauncher active={Boolean(activeSession)} onResume={() => activeSession && setWorkoutId(activeSession.id)} onSelect={setPendingPlan} />}
      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton label="Home" active={view === "home"} onClick={() => setView("home")}><Home size={20} /></NavButton>
        <NavButton label="Plans" active={view === "plans"} onClick={() => setView("plans")}><Dumbbell size={20} /></NavButton>
        <NavButton label="History" active={view === "history"} onClick={() => setView("history")}><CalendarDays size={20} /></NavButton>
        <NavButton label="Settings" active={view === "settings"} onClick={() => setView("settings")}><Settings size={20} /></NavButton>
      </nav>
    </main>
  );
}

function NavButton({ label, active, onClick, children }: { label: string; active: boolean; onClick(): void; children: React.ReactNode }) {
  return <button className="nav-item" data-active={active} onClick={onClick}>{children}<span>{label}</span></button>;
}
