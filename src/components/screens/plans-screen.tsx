"use client";

import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PRESET_PLANS } from "@/domain/presets";
import type { Equipment, MuscleGroup, WorkoutPlan } from "@/domain/types";
import { useWorkoutStore } from "@/features/workouts/workout-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function PlansScreen() {
  const store = useWorkoutStore();
  const [editing, setEditing] = useState<WorkoutPlan | "new">();
  const [menu, setMenu] = useState<string>();
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlan>();

  return (
    <>
      <header className="page-header plans-header">
        <div><h1 className="page-title">Workout plans</h1></div>
        <button className="button-primary" onClick={() => setEditing("new")}><Plus size={19} /> New plan</button>
      </header>

      {store.plans.length > 0 && <section className="plan-grid" aria-label="Your workout plans">
        {store.plans.map((plan) => <article className="plan-card card" key={plan.id}>
          <button className="plan-menu" onClick={() => setMenu(menu === plan.id ? undefined : plan.id)} aria-label={`Actions for ${plan.name}`}><MoreHorizontal /></button>
          {menu === plan.id && <div className="popover">
            <button onClick={() => { setEditing(plan); setMenu(undefined); }}><Pencil size={15} /> Edit</button>
            <button onClick={() => { void store.duplicatePlan(plan); setMenu(undefined); }}><Copy size={15} /> Duplicate</button>
            <button className="danger-text" onClick={() => { setPlanToDelete(plan); setMenu(undefined); }}><Trash2 size={15} /> Delete</button>
          </div>}
          <span className="eyebrow">{plan.exerciseIds.length} exercises · {plan.restSeconds}s rest</span>
          <h2 className="display">{plan.name}</h2>
          <p>{plan.exerciseIds.slice(0, 3).map((id) => store.exercises.find((exercise) => exercise.id === id)?.name).filter(Boolean).join(" · ")}{plan.exerciseIds.length > 3 ? "…" : ""}</p>
        </article>)}
      </section>}

      <section className="preset-section">
        <div className="section-heading"><div><span className="eyebrow">Ready-made</span><h2 className="display section-title">Starter plans</h2></div></div>
        <div className="preset-strip">
          {PRESET_PLANS.map((preset, index) => <article className="preset-card" key={preset.name}>
            <button className="icon-button preset-copy" onClick={() => void store.copyPreset(index)} aria-label={`Copy ${preset.name}`}><Plus /></button>
            <span className="preset-count display">{preset.exerciseIds.length}</span>
            <div className="preset-card-copy"><small>exercises</small><h3 className="display">{preset.name}</h3></div>
          </article>)}
        </div>
      </section>
      {editing && <PlanEditor plan={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} />}
      {planToDelete && <ConfirmDialog title="Delete plan?" message={`“${planToDelete.name}” will be removed from your account on every device. Past workout sessions will remain in History.`} confirmLabel="Delete plan" tone="danger" onClose={() => setPlanToDelete(undefined)} onConfirm={() => store.deletePlan(planToDelete.id)} />}
    </>
  );
}

function PlanEditor({ plan, onClose }: { plan?: WorkoutPlan; onClose(): void }) {
  const store = useWorkoutStore();
  const [name, setName] = useState(plan?.name ?? "");
  const [restSeconds, setRestSeconds] = useState(plan?.restSeconds ?? 60);
  const [exerciseIds, setExerciseIds] = useState(plan?.exerciseIds ?? []);
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const visibleExercises = useMemo(() => store.exercises.filter((exercise) => exercise.name.toLowerCase().includes(query.toLowerCase())), [query, store.exercises]);

  function move(index: number, direction: -1 | 1) {
    const next = [...exerciseIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setExerciseIds(next);
  }

  async function save() {
    if (!name.trim() || exerciseIds.length === 0) return;
    await store.savePlan({ id: plan?.id ?? crypto.randomUUID(), name, restSeconds, exerciseIds });
    onClose();
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-editor-title">
      <div className="row-between"><div><span className="eyebrow">Plan editor</span><h2 id="plan-editor-title" className="display">{plan ? "Edit plan" : "New plan"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="editor-fields">
        <label className="field">Plan name<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Upper body burn" autoFocus /></label>
        <label className="field">Default rest (seconds)<input type="number" min="0" value={restSeconds} onChange={(event) => setRestSeconds(Math.max(0, Number(event.target.value)))} /></label>
      </div>
      <div className="selected-list">
        <span className="eyebrow">Exercise order</span>
        {exerciseIds.length === 0 && <p className="muted">Add at least one exercise below.</p>}
        {exerciseIds.map((id, index) => {
          const exercise = store.exercises.find((item) => item.id === id);
          if (!exercise) return null;
          return <div className="selected-row" key={`${id}-${index}`}><b className="display">{index + 1}</b><span>{exercise.name}</span><button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${exercise.name} up`}><ArrowUp size={17} /></button><button onClick={() => move(index, 1)} disabled={index === exerciseIds.length - 1} aria-label={`Move ${exercise.name} down`}><ArrowDown size={17} /></button><button onClick={() => setExerciseIds(exerciseIds.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${exercise.name}`}><X size={17} /></button></div>;
        })}
      </div>
      <div className="exercise-picker">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" aria-label="Search exercises" /></label>
        <div className="exercise-options">{visibleExercises.map((exercise) => <button key={exercise.id} onClick={() => setExerciseIds([...exerciseIds, exercise.id])}><span><strong>{exercise.name}</strong><small>{exercise.muscleGroup} · {exercise.equipment}</small></span><Plus size={18} /></button>)}</div>
        {customOpen ? <CustomExerciseForm onAdded={(id) => { setExerciseIds([...exerciseIds, id]); setCustomOpen(false); }} /> : <button className="button-secondary full-button" onClick={() => setCustomOpen(true)}><Plus size={17} /> Create custom exercise</button>}
      </div>
      <div className="dialog-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!name.trim() || exerciseIds.length === 0} onClick={() => void save()}>Save plan</button></div>
    </div>
  </div>;
}

function CustomExerciseForm({ onAdded }: { onAdded(id: string): void }) {
  const store = useWorkoutStore();
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Chest");
  const [equipment, setEquipment] = useState<Equipment>("Bodyweight");
  async function submit() {
    if (!name.trim()) return;
    onAdded(await store.addExercise({ name, muscleGroup, equipment }));
  }
  return <div className="custom-form raised"><label className="field">Exercise name<input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="editor-fields"><label className="field">Muscle group<select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value as MuscleGroup)}>{["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Equipment<select value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment)}><option>Bodyweight</option><option>Dumbbells</option></select></label></div><button className="button-primary" disabled={!name.trim()} onClick={() => void submit()}>Add exercise</button></div>;
}
