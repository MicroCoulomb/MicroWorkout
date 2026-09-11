"use client";

import { ChevronDown, ChevronLeft, ChevronUp, Dumbbell, Pause, Play, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { PRESET_PLANS } from "@/domain/presets";
import type { WorkoutPlan } from "@/domain/types";
import { useWorkoutStore } from "@/features/workouts/workout-store";

export function WorkoutLauncher({ active, onResume, onSelect }: { active: boolean; onResume(): void; onSelect(plan: WorkoutPlan): void }) {
  const [open, setOpen] = useState(false);

  function select(plan: WorkoutPlan) {
    setOpen(false);
    onSelect(plan);
  }

  return <>
    <button className="workout-launcher" onClick={() => active ? onResume() : setOpen(true)} aria-label={active ? "Resume workout" : "Choose a workout"}>
      {active ? <RotateCcw /> : <Play fill="currentColor" />}
      <span className="sr-only">{active ? "Resume workout" : "Choose a workout"}</span>
    </button>
    {open && <WorkoutPicker onClose={() => setOpen(false)} onSelect={select} />}
  </>;
}

function WorkoutPicker({ onClose, onSelect }: { onClose(): void; onSelect(plan: WorkoutPlan): void }) {
  const { plans } = useWorkoutStore();
  const [starterOpen, setStarterOpen] = useState(plans.length === 0);

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dialog workout-picker" role="dialog" aria-modal="true" aria-labelledby="workout-picker-title">
      <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
      <span className="eyebrow">Workout launcher</span>
      <h2 id="workout-picker-title" className="display">Choose a workout</h2>
      {plans.length > 0 && <div className="workout-choice-list">
        <span className="eyebrow">Your plans</span>
        {plans.map((plan) => <PlanChoice key={plan.id} plan={plan} onClick={() => onSelect(plan)} />)}
      </div>}
      <section className="starter-accordion">
        <button className="starter-toggle" onClick={() => setStarterOpen((value) => !value)} aria-expanded={starterOpen}>
          <span><span className="eyebrow">Ready-made</span><strong className="display">Starter plans</strong></span>
          {starterOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {starterOpen && <div className="workout-choice-list starter-choice-list">
          {PRESET_PLANS.map((preset, index) => {
            const plan = { ...preset, id: `starter-${index}`, updatedAt: 0 };
            return <PlanChoice key={preset.name} plan={plan} onClick={() => onSelect(plan)} />;
          })}
        </div>}
      </section>
    </section>
  </div>;
}

function PlanChoice({ plan, onClick }: { plan: WorkoutPlan; onClick(): void }) {
  return <button className="workout-choice" onClick={onClick}>
    <span className="workout-choice-mark"><Dumbbell size={18} /></span>
    <span><strong className="display">{plan.name}</strong><small>{plan.exerciseIds.length} exercises · {plan.restSeconds}s rest</small></span>
    <Play size={18} fill="currentColor" />
  </button>;
}

export function WorkoutStartScreen({ plan, onBack, onStart }: { plan: WorkoutPlan; onBack(): void; onStart(): Promise<void> }) {
  const { exercises } = useWorkoutStore();
  const [starting, setStarting] = useState(false);
  const exerciseNames = plan.exerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)?.name).filter((name): name is string => Boolean(name));

  async function start() {
    if (starting) return;
    setStarting(true);
    try { await onStart(); }
    finally { setStarting(false); }
  }

  return <main className="workout-shell prestart-shell">
    <header className="workout-top">
      <button className="icon-button" onClick={onBack} aria-label="Back to workout selection"><ChevronLeft /></button>
      <div><span>{plan.name}</span><b className="display">00:00</b></div>
      <button className="icon-button prestart-pause" disabled aria-label="Workout has not started"><Pause fill="currentColor" /></button>
    </header>
    <section className="exercise-stage prestart-stage">
      <div className="progress-track"><span style={{ width: "0%" }} /></div>
      <div className="exercise-counter display">00<small>/{String(exerciseNames.length).padStart(2, "0")}</small></div>
      <span className="eyebrow">First up</span>
      <h1 className="display">{exerciseNames[0] ?? "Start workout"}</h1>
      <button className="prestart-button" disabled={starting} onClick={() => void start()} aria-label="Start workout"><Play size={58} fill="currentColor" /></button>
    </section>
    <section className="live-log prestart-details">
      <span className="eyebrow">Workout details</span>
      <div className="prestart-meta"><span>{exerciseNames.length} exercises</span><span>{plan.restSeconds}s rest between sets</span></div>
      <ol className="prestart-exercises">{exerciseNames.map((name, index) => <li key={`${name}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{name}</span></li>)}</ol>
    </section>
  </main>;
}
