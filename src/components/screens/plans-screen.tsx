"use client";

import { ArrowDown, ArrowUp, Copy, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRESET_PLANS } from "@/domain/presets";
import type { Equipment, MuscleGroup, WorkoutPlan } from "@/domain/types";
import { useWorkoutStore } from "@/features/workouts/workout-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function PlansScreen() {
  const store = useWorkoutStore();
  const [editing, setEditing] = useState<WorkoutPlan | "new">();
  const [menu, setMenu] = useState<string>();
  const [openPlanId, setOpenPlanId] = useState<string>();
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlan>();
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const customExerciseReceiver = useRef<((id: string) => void) | undefined>(undefined);
  const longPressTimer = useRef<number | undefined>(undefined);
  const longPressTriggered = useRef(false);

  function openCustomExercise(onSaved?: (id: string) => void) {
    customExerciseReceiver.current = onSaved;
    setCustomExerciseOpen(true);
  }

  function closeCustomExercise() {
    customExerciseReceiver.current = undefined;
    setCustomExerciseOpen(false);
  }

  function cancelLongPress() {
    if (longPressTimer.current === undefined) return;
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = undefined;
  }

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      const target = event.target as Node;
      setOpenPlanId((currentPlanId) => currentPlanId && !cardRefs.current.get(currentPlanId)?.contains(target) ? undefined : currentPlanId);
      setMenu((currentMenuId) => currentMenuId && !cardRefs.current.get(currentMenuId)?.contains(target) ? undefined : currentMenuId);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenPlanId(undefined);
      setMenu(undefined);
    }

    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => () => cancelLongPress(), []);

  return (
    <>
      <header className="page-header plans-header">
        <div><h1 className="page-title">Workout plans</h1></div>
      </header>

      {store.plans.length > 0 && <section className="plan-grid" aria-label="Your workout plans">
        {store.plans.map((plan) => {
          const isOpen = openPlanId === plan.id;
          const isMenuOpen = menu === plan.id;

          return <article className="plan-card card" key={plan.id} ref={(node) => {
            if (node) cardRefs.current.set(plan.id, node);
            else cardRefs.current.delete(plan.id);
          }}>
            <div className="plan-card-controls">
              <button
                className="plan-view"
                aria-label={`View exercises for ${plan.name}`}
                aria-controls={`plan-exercises-${plan.id}`}
                aria-expanded={isOpen}
                onClick={() => {
                  setOpenPlanId(isOpen ? undefined : plan.id);
                  setMenu(undefined);
                }}
              ><Eye size={18} /></button>
              <button
                className="plan-menu"
                aria-label={`Actions for ${plan.name}`}
                aria-controls={`plan-menu-${plan.id}`}
                aria-expanded={isMenuOpen}
                onClick={() => {
                  setMenu(isMenuOpen ? undefined : plan.id);
                  setOpenPlanId(undefined);
                }}
              ><MoreHorizontal size={19} /></button>
            </div>
            {isMenuOpen && <div id={`plan-menu-${plan.id}`} className="popover">
              <button onClick={() => { setEditing(plan); setMenu(undefined); }}><Pencil size={15} /> Edit</button>
              <button onClick={() => { void store.duplicatePlan(plan); setMenu(undefined); }}><Copy size={15} /> Duplicate</button>
              <button className="danger-text" onClick={() => { setPlanToDelete(plan); setMenu(undefined); }}><Trash2 size={15} /> Delete</button>
            </div>}
            <span className="eyebrow">{plan.exerciseIds.length} exercises · {plan.restSeconds}s rest</span>
            <h2 className="display">{plan.name}</h2>
            {isOpen && <ol id={`plan-exercises-${plan.id}`} className="plan-exercise-list">
              {plan.exerciseIds.map((exerciseId, index) => {
                const exercise = store.exercises.find((item) => item.id === exerciseId);
                return <li key={`${exerciseId}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{exercise?.name ?? "Removed exercise"}</span></li>;
              })}
            </ol>}
          </article>;
        })}
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
      <button
        className="plan-create-launcher"
        aria-label="Create new workout plan"
        title="Hold to create a custom exercise"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          longPressTriggered.current = false;
          cancelLongPress();
          longPressTimer.current = window.setTimeout(() => {
            longPressTriggered.current = true;
            longPressTimer.current = undefined;
            openCustomExercise();
          }, 600);
        }}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onClick={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }
          setEditing("new");
        }}
      ><Plus size={26} /></button>
      {editing && <PlanEditor plan={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onCreateCustomExercise={openCustomExercise} />}
      {customExerciseOpen && <CustomExerciseDialog onClose={closeCustomExercise} onSaved={(id) => customExerciseReceiver.current?.(id)} />}
      {planToDelete && <ConfirmDialog title="Delete plan?" message={`“${planToDelete.name}” will be removed from your account on every device. Past workout sessions will remain in History.`} confirmLabel="Delete plan" tone="danger" onClose={() => setPlanToDelete(undefined)} onConfirm={() => store.deletePlan(planToDelete.id)} />}
    </>
  );
}

function PlanEditor({ plan, onClose, onCreateCustomExercise }: { plan?: WorkoutPlan; onClose(): void; onCreateCustomExercise(onSaved: (id: string) => void): void }) {
  const store = useWorkoutStore();
  const [name, setName] = useState(plan?.name ?? "");
  const [restSeconds, setRestSeconds] = useState(plan?.restSeconds ?? 60);
  const [exerciseIds, setExerciseIds] = useState(plan?.exerciseIds ?? []);
  const [query, setQuery] = useState("");
  const visibleExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return store.exercises;
    return store.exercises.filter((exercise) => [exercise.name, exercise.muscleGroup, exercise.equipment].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  }, [query, store.exercises]);

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
        <label className="field">Plan name<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Upper body burn" autoFocus={!plan} /></label>
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
        <button className="button-secondary full-button" onClick={() => onCreateCustomExercise((id) => setExerciseIds((current) => [...current, id]))}><Plus size={17} /> Create custom exercise</button>
      </div>
      <div className="dialog-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!name.trim() || exerciseIds.length === 0} onClick={() => void save()}>Save plan</button></div>
    </div>
  </div>;
}

function CustomExerciseDialog({ onClose, onSaved }: { onClose(): void; onSaved(id: string): void }) {
  const store = useWorkoutStore();
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("Chest");
  const [equipment, setEquipment] = useState<Equipment>("Bodyweight");
  const [error, setError] = useState("");

  async function save() {
    const normalizedName = titleCaseExerciseName(name);
    if (!normalizedName) return;
    if (store.exercises.some((exercise) => exercise.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
      setError(`“${normalizedName}” is already in your exercise library.`);
      return;
    }
    const id = await store.addExercise({ name: normalizedName, muscleGroup, equipment });
    onSaved(id);
    onClose();
  }
  return <div className="dialog-backdrop custom-exercise-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="dialog custom-exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-exercise-title">
      <div className="row-between"><div><span className="eyebrow">Exercise library</span><h2 id="custom-exercise-title" className="display">New custom exercise</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="editor-fields">
        <label className="field">Exercise name<input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="Single-arm press" autoFocus /></label>
        <label className="field">Muscle group<select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value as MuscleGroup)}>{["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field">Equipment<select value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment)}><option>Bodyweight</option><option>Dumbbells</option></select></label>
      </div>
      {error && <p className="custom-exercise-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!name.trim()} onClick={() => void save()}>Save exercise</button></div>
    </div>
  </div>;
}

function titleCaseExerciseName(value: string) {
  return value.trim().replace(/\s+/g, " ").split(" ").map((word) => word.split("-").map((part) => part ? part[0].toLocaleUpperCase() + part.slice(1).toLocaleLowerCase() : part).join("-")).join(" ");
}
