"use client";

import { ChevronDown, Info, LogOut, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { WeightUnit } from "@/domain/types";
import { useWorkoutStore } from "@/features/workouts/workout-store";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InstallAppCard } from "@/components/ui/install-app-card";

export function SettingsScreen({ isAdmin, canDeleteAccount, syncEnabled, onAdmin }: { isAdmin: boolean; canDeleteAccount: boolean; syncEnabled: boolean; onAdmin(): void }) {
  const store = useWorkoutStore();
  const router = useRouter();
  const [name, setName] = useState(store.profile?.name ?? "");
  const [goal, setGoal] = useState(store.profile?.weeklyGoal ?? 3);
  const [unit, setUnit] = useState<WeightUnit>(store.profile?.weightUnit ?? "kg");
  const [saved, setSaved] = useState(false);
  const [pendingAction, setPendingAction] = useState<"clear" | "delete-account">();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function save() {
    await store.updateProfile({ name: name.trim() || "Athlete", weeklyGoal: goal, weightUnit: unit });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function confirmAction() {
    if (pendingAction === "clear") {
      await store.clearLocalData();
      window.localStorage.removeItem("microworkout-last-user");
      await authClient.signOut();
      router.refresh();
    }
    if (pendingAction === "delete-account") {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (response.ok) {
        await store.clearLocalData();
        window.localStorage.removeItem("microworkout-last-user");
        await authClient.signOut();
        router.refresh();
      }
    }
    setPendingAction(undefined);
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    const result = await store.syncNow();
    if (result.pendingChanges > 0) {
      setSignOutError(result.status === "locked"
        ? `${result.pendingChanges} local change${result.pendingChanges === 1 ? "" : "s"} could not sync because your session expired. Sign in again to upload them.`
        : `${result.pendingChanges} local change${result.pendingChanges === 1 ? "" : "s"} could not sync. Check your connection and retry sign out.`);
      setSigningOut(false);
      return;
    }
    await finishSignOut();
  }

  async function finishSignOut() {
    window.localStorage.removeItem("microworkout-last-user");
    await authClient.signOut();
    router.refresh();
  }

  return <>
    <header className="page-header"><div><h1 className="page-title">Settings</h1></div></header>
    <div className="settings-grid">
      <section className="settings-card card"><span className="eyebrow">Profile</span><h2 className="display">Training defaults</h2><div className="stack"><label className="field">Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field">Weekly workout goal<select value={goal} onChange={(event) => setGoal(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} workout{value === 1 ? "" : "s"}</option>)}</select></label><label className="field">Weight unit<select value={unit} onChange={(event) => setUnit(event.target.value as WeightUnit)}><option value="kg">Kilograms</option><option value="lb">Pounds</option></select></label><button className="button-primary" onClick={() => void save()}>{saved ? "Saved" : "Save settings"}</button></div></section>
      <InstallAppCard />
      {isAdmin && <section className="settings-card card admin-entry"><ShieldCheck /><span className="eyebrow">Owner tools</span><h2 className="display">Access administration</h2><p>Invite, revoke, and reactivate user emails without viewing their workout data.</p><button className="button-primary" onClick={onAdmin}>Manage access</button></section>}
      {isAdmin && <SharedExerciseLibrary />}
      <section className="danger-zone card"><span className="eyebrow">Account controls</span><h2 className="display">Private data</h2><p>Clear cached records on this device, sign out, or permanently delete your account and owned data.</p><button className="button-secondary" onClick={() => setPendingAction("clear")}><Trash2 size={18} /> Clear this device</button>{syncEnabled && <button className="button-secondary" disabled={signingOut} onClick={() => void signOut()}><LogOut size={18} /> {signingOut ? "Syncing..." : signOutError ? "Retry sign out" : "Sign out"}</button>}{syncEnabled && canDeleteAccount && <button className="button-danger" onClick={() => setPendingAction("delete-account")}><Trash2 size={18} /> Delete account</button>}{signOutError && <div className="signout-warning" role="alert"><p>{signOutError}</p>{store.syncStatus === "locked" && <button className="text-button" onClick={() => void finishSignOut()}>Sign in again</button>}</div>}</section>
      <details className="more-info card"><summary><span className="more-info-mark"><Info size={18} /></span><span className="more-info-title"><span className="eyebrow">More info</span><strong>About your data</strong></span><ChevronDown size={18} /></summary><div className="more-info-body"><section className="more-info-section"><span className="eyebrow">Offline data</span><p>Plans, sessions, and history remain available without a connection. {store.pendingChanges} local change{store.pendingChanges === 1 ? "" : "s"} waiting to sync.</p></section><section className="more-info-section"><span className="eyebrow">Private by design</span><p>Workout data is isolated to your account. Administrators manage access records only.</p></section></div></details>
    </div>
    {pendingAction && <ConfirmDialog title={pendingAction === "clear" ? "Clear this device?" : "Delete your account?"} message={pendingAction === "clear" ? `${store.pendingChanges ? `${store.pendingChanges} unsynced local change${store.pendingChanges === 1 ? "" : "s"} will be permanently lost. ` : ""}This removes this account's cached plans and workouts from this device and signs you out. Synced data returns after your next sign-in.` : "Your account and all workout data will be permanently deleted."} confirmLabel={pendingAction === "clear" ? "Clear device" : "Delete account"} tone="danger" onClose={() => setPendingAction(undefined)} onConfirm={() => void confirmAction()} />}
  </>;
}

interface SharedExerciseRecord {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

function SharedExerciseLibrary() {
  const [exercises, setExercises] = useState<SharedExerciseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [retiring, setRetiring] = useState<SharedExerciseRecord>();
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/exercises");
    if (response.ok) setExercises(await response.json() as SharedExerciseRecord[]);
    else setError("Could not load the shared exercise library.");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function retire() {
    if (!retiring) return;
    const response = await fetch("/api/admin/exercises", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: retiring.id }) });
    if (response.ok) {
      setExercises((current) => current.filter((exercise) => exercise.id !== retiring.id));
      setRetiring(undefined);
      return;
    }
    setError("Could not retire that exercise.");
  }

  const visibleExercises = exercises.filter((exercise) => exercise.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="shared-exercise-admin card"><span className="eyebrow">Owner tools</span><h2 className="display">Shared exercise library</h2><p>Retired exercises stay in existing plans and workout history, but can no longer be added to new plans.</p><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shared exercises" aria-label="Search shared exercises" /></label><div className="shared-exercise-list">{visibleExercises.map((exercise) => <div key={exercise.id}><span><strong>{exercise.name}</strong><small>{exercise.muscleGroup} · {exercise.equipment}</small></span><button className="button-danger" onClick={() => setRetiring(exercise)}><Trash2 size={16} /> Retire</button></div>)}</div>{error && <p className="form-error">{error}</p>}{retiring && <ConfirmDialog title="Retire shared exercise?" message={`${retiring.name} will be hidden from new plans. Existing plans and workout history will remain unchanged.`} confirmLabel="Retire exercise" tone="danger" onClose={() => setRetiring(undefined)} onConfirm={retire} />}</section>;
}
