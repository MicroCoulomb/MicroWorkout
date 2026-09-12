"use client";

import { ChevronDown, ClipboardCheck, Info, LibraryBig, LogOut, Pencil, Search, ShieldCheck, Trash2, Users, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MUSCLE_GROUPS, type Equipment, type MuscleGroup, type WeightUnit } from "@/domain/types";
import { useWorkoutStore } from "@/features/workouts/workout-store";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InstallAppCard } from "@/components/ui/install-app-card";
import { SyncStatusButton } from "@/components/ui/sync-status-button";

export function SettingsScreen({ isAdmin, onAdmin }: { isAdmin: boolean; onAdmin(): void }) {
  const store = useWorkoutStore();
  const router = useRouter();
  const [name, setName] = useState(store.profile?.name ?? "");
  const [goal, setGoal] = useState(store.profile?.weeklyGoal ?? 3);
  const [unit, setUnit] = useState<WeightUnit>(store.profile?.weightUnit ?? "kg");
  const [savedProfile, setSavedProfile] = useState(() => ({ name: store.profile?.name ?? "Athlete", goal: store.profile?.weeklyGoal ?? 3, unit: store.profile?.weightUnit ?? "kg" }));
  const [saved, setSaved] = useState(false);
  const [pendingAction, setPendingAction] = useState<"clear" | "sign-out">();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const normalizedName = name.trim() || "Athlete";
  const hasProfileChanges = normalizedName !== savedProfile.name || goal !== savedProfile.goal || unit !== savedProfile.unit;

  async function save() {
    await store.updateProfile({ name: normalizedName, weeklyGoal: goal, weightUnit: unit });
    setName(normalizedName);
    setSavedProfile({ name: normalizedName, goal, unit });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }
  async function finishSignOut() {
    window.localStorage.removeItem("microworkout-last-user");
    await authClient.signOut();
    router.refresh();
  }
  async function signOut() {
    setSigningOut(true); setSignOutError("");
    const result = await store.syncNow();
    if (result.pendingChanges > 0) {
      setSignOutError(result.status === "locked" ? `${result.pendingChanges} local change${result.pendingChanges === 1 ? "" : "s"} could not sync because your session expired. Sign in again to upload them.` : `${result.pendingChanges} local change${result.pendingChanges === 1 ? "" : "s"} could not sync. Check your connection and retry sign out.`);
      setSigningOut(false); return;
    }
    await finishSignOut();
  }
  async function confirmAction() {
    if (pendingAction === "clear") {
      await store.clearLocalData(); window.localStorage.removeItem("microworkout-last-user"); await authClient.signOut(); router.refresh();
    }
    if (pendingAction === "sign-out") await signOut();
    setPendingAction(undefined);
  }

  return <>
    <header className="page-header settings-page-header"><h1 className="page-title">Settings</h1><SyncStatusButton /></header>
    <div className="settings-grid">
      <section className="settings-card card"><span className="eyebrow">Profile</span><div className="settings-profile-fields"><label className="field">Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="profile-preferences"><label className="field">Weekly Goal<select value={goal} onChange={(event) => setGoal(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} workout{value === 1 ? "" : "s"}</option>)}</select></label><label className="field">Weight unit<select value={unit} onChange={(event) => setUnit(event.target.value as WeightUnit)}><option value="kg">Kilograms</option><option value="lb">Pounds</option></select></label></div><button className="button-primary" disabled={!hasProfileChanges} onClick={() => void save()}>{saved ? "Saved" : "Save settings"}</button></div></section>
      <InstallAppCard />
      {isAdmin && <OwnerTools onAdmin={onAdmin} />}
      <section className="danger-zone card"><span className="eyebrow">Account controls</span><div className="account-actions"><button className="button-secondary account-clear" onClick={() => setPendingAction("clear")}><Trash2 size={16} /> Clear Records</button><button className="button-secondary" disabled={signingOut} onClick={() => setPendingAction("sign-out")}><LogOut size={16} /> {signingOut ? "Syncing..." : signOutError ? "Retry Sign Out" : "Sign Out"}</button></div>{signOutError && <div className="signout-warning" role="alert"><p>{signOutError}</p>{store.syncStatus === "locked" && <button className="text-button" onClick={() => void finishSignOut()}>Sign in again</button>}</div>}</section>
      <details className="more-info card"><summary><span className="more-info-mark"><Info size={18} /></span><span className="more-info-title"><span className="eyebrow">More info</span><strong>About your data</strong></span><ChevronDown size={18} /></summary><div className="more-info-body"><section className="more-info-section"><span className="eyebrow">Offline data</span><p>Plans, sessions, and history remain available without a connection. {store.pendingChanges} local change{store.pendingChanges === 1 ? "" : "s"} waiting to sync.</p></section><section className="more-info-section"><span className="eyebrow">Private by design</span><p>Workout data is isolated to your account. Administrators manage access records only.</p></section></div></details>
    </div>
    {pendingAction && <ConfirmDialog title={pendingAction === "clear" ? "Clear records?" : "Sign out?"} message={pendingAction === "clear" ? `${store.pendingChanges ? `${store.pendingChanges} unsynced local change${store.pendingChanges === 1 ? "" : "s"} will be permanently lost. ` : ""}This removes cached plans and workouts from this device and signs you out. Synced data returns after your next sign-in.` : "Pending changes will be synced before you sign out. If they cannot be synced, you can retry."} confirmLabel={pendingAction === "clear" ? "Clear Records" : "Sign Out"} tone="danger" onClose={() => setPendingAction(undefined)} onConfirm={() => void confirmAction()} />}
  </>;
}

interface SharedExerciseRecord { id: string; name: string; muscleGroup: MuscleGroup; equipment: Equipment; builtin: boolean; retiredAt: string | null; }

function OwnerTools({ onAdmin }: { onAdmin(): void }) {
  const [libraryMode, setLibraryMode] = useState<"all" | "custom">();
  return <section className="settings-card card owner-tools"><ShieldCheck className="owner-tools-mark" /><span className="eyebrow">Owner tools</span><div className="owner-tool-actions"><button className="button-primary" onClick={onAdmin}><Users size={18} /> Manage Access</button><span className="owner-tool-placeholder" aria-hidden="true" /><button className="button-secondary" onClick={() => setLibraryMode("all")}><LibraryBig size={18} /> Edit Exercise Lib</button><button className="button-secondary" onClick={() => setLibraryMode("custom")}><Wrench size={18} /> Fix Exercise Lib</button></div>{libraryMode && <SharedExerciseLibrary mode={libraryMode} onClose={() => setLibraryMode(undefined)} />}</section>;
}

function SharedExerciseLibrary({ mode, onClose }: { mode: "all" | "custom"; onClose(): void }) {
  const store = useWorkoutStore();
  const [exercises, setExercises] = useState<SharedExerciseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [retiring, setRetiring] = useState<SharedExerciseRecord>();
  const [editing, setEditing] = useState<SharedExerciseRecord>();
  const [error, setError] = useState("");
  async function load() { const response = await fetch("/api/admin/exercises"); if (response.ok) setExercises(await response.json() as SharedExerciseRecord[]); else setError("Could not load the shared exercise library."); }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  async function retire() {
    if (!retiring) return;
    const response = await fetch("/api/admin/exercises", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: retiring.id }) });
    if (!response.ok) { setError("Could not delete that exercise."); return; }
    await store.syncNow();
    setExercises((current) => current.map((exercise) => exercise.id === retiring.id ? { ...exercise, retiredAt: new Date().toISOString() } : exercise));
    setRetiring(undefined);
  }
  const isFixing = mode === "custom";
  const visibleExercises = exercises.filter((exercise) => !exercise.retiredAt && (mode === "all" || !exercise.builtin) && exercise.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog exercise-library-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-library-title"><button className="dialog-close" aria-label="Close exercise library" onClick={onClose}><X size={18} /></button><span className="eyebrow">Owner tools</span><h2 id="exercise-library-title" className="display">{isFixing ? "Fix Exercise Library" : "Edit Exercise Library"}</h2><p className="exercise-library-copy">{isFixing ? "Review active custom exercises shared by your members." : "Edit every shared exercise. Deleting an exercise safely removes it from future plans."}</p><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" aria-label="Search exercises" /></label><div className="shared-exercise-list">{visibleExercises.map((exercise) => <div key={exercise.id}><span><strong>{exercise.name}</strong><small>{exercise.muscleGroup} · {exercise.equipment}{exercise.builtin ? " · Built-in" : ""}{exercise.retiredAt ? " · Retired" : ""}</small></span><div className="shared-exercise-actions"><button className="icon-action" aria-label={`Edit ${exercise.name}`} onClick={() => setEditing(exercise)}><Pencil size={16} /></button>{!exercise.retiredAt && <button className="icon-action icon-action-danger" aria-label={`Delete ${exercise.name}`} onClick={() => setRetiring(exercise)}><Trash2 size={16} /></button>}</div></div>)}</div>{!error && visibleExercises.length === 0 && <div className="exercise-library-empty"><ClipboardCheck size={22} /><p>{isFixing ? "No active custom exercises need review." : "No exercises match your search."}</p></div>}{error && <p className="form-error">{error}</p>}{editing && <EditExerciseDialog exercise={editing} onClose={() => setEditing(undefined)} onSaved={async (updated) => { await store.syncNow(); setExercises((current) => current.map((exercise) => exercise.id === updated.id ? updated : exercise)); setEditing(undefined); }} />}{retiring && <ConfirmDialog title="Delete shared exercise?" message={`${retiring.name} will be removed from new plans. Existing plans and workout history will remain unchanged.`} confirmLabel="Delete exercise" tone="danger" onClose={() => setRetiring(undefined)} onConfirm={retire} />}</section></div>;
}

function EditExerciseDialog({ exercise, onClose, onSaved }: { exercise: SharedExerciseRecord; onClose(): void; onSaved(exercise: SharedExerciseRecord): Promise<void> }) {
  const [name, setName] = useState(exercise.name); const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(exercise.muscleGroup); const [equipment, setEquipment] = useState<Equipment>(exercise.equipment); const [error, setError] = useState("");
  async function save() { const response = await fetch("/api/admin/exercises", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: exercise.id, name, muscleGroup, equipment }) }); if (response.ok) await onSaved(await response.json() as SharedExerciseRecord); else setError(response.status === 409 ? "That exercise name is already in use." : "Could not save the exercise."); }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog exercise-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-editor-title"><span className="eyebrow">Owner editor</span><h2 id="exercise-editor-title" className="display">Edit exercise</h2><div className="editor-fields"><label className="field">Exercise name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field">Muscle group<select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value as MuscleGroup)}>{MUSCLE_GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label><label className="field">Equipment<select value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment)}><option>Bodyweight</option><option>Dumbbells</option></select></label></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!name.trim()} onClick={() => void save()}>Save exercise</button></div></section></div>;
}
