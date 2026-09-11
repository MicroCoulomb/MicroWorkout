"use client";

import { CalendarDays, Dumbbell, Home, Settings } from "lucide-react";
import { useEffect, useState } from "react";
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
  const activeSession = typeof window === "undefined" ? undefined : sessions.find(
    (session) => (session.status === "active" || session.status === "paused") && session.deviceId === currentDeviceId,
  );

  if (!ready) {
    return <main className="app-frame"><div className="loading-mark display">MW</div></main>;
  }

  const selectedSession = workoutId ? sessions.find((session) => session.id === workoutId) : undefined;
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
    <main className="app-frame">
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
