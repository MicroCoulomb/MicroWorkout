import type { Exercise, WorkoutPlan } from "./types";

type ExerciseSeed = Omit<Exercise, "updatedAt">;

export const BUILTIN_EXERCISES: ExerciseSeed[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Push-Up", muscleGroup: "Chest", equipment: "Bodyweight", builtin: true },
  { id: "00000000-0000-4000-8000-000000000002", name: "Dumbbell Floor Press", muscleGroup: "Chest", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000003", name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000004", name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000005", name: "Dumbbell Triceps Extension", muscleGroup: "Arms", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000006", name: "One-Arm Dumbbell Row", muscleGroup: "Back", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000007", name: "Dumbbell Reverse Fly", muscleGroup: "Back", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000008", name: "Dumbbell Biceps Curl", muscleGroup: "Arms", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000009", name: "Hammer Curl", muscleGroup: "Arms", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000010", name: "Goblet Squat", muscleGroup: "Legs", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000011", name: "Dumbbell Romanian Deadlift", muscleGroup: "Legs", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000012", name: "Reverse Lunge", muscleGroup: "Legs", equipment: "Dumbbells", builtin: true },
  { id: "00000000-0000-4000-8000-000000000013", name: "Glute Bridge", muscleGroup: "Glutes", equipment: "Bodyweight", builtin: true },
  { id: "00000000-0000-4000-8000-000000000014", name: "Standing Calf Raise", muscleGroup: "Legs", equipment: "Bodyweight", builtin: true },
];

export const PRESET_PLANS: Omit<WorkoutPlan, "id" | "updatedAt">[] = [
  { name: "Push", restSeconds: 60, exerciseIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004", "00000000-0000-4000-8000-000000000005"] },
  { name: "Pull", restSeconds: 60, exerciseIds: ["00000000-0000-4000-8000-000000000006", "00000000-0000-4000-8000-000000000007", "00000000-0000-4000-8000-000000000008", "00000000-0000-4000-8000-000000000009"] },
  { name: "Legs", restSeconds: 60, exerciseIds: ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012", "00000000-0000-4000-8000-000000000013", "00000000-0000-4000-8000-000000000014"] },
  { name: "Upper Body", restSeconds: 60, exerciseIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000006", "00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004", "00000000-0000-4000-8000-000000000008", "00000000-0000-4000-8000-000000000005"] },
  { name: "Full Body", restSeconds: 60, exerciseIds: ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000006", "00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012", "00000000-0000-4000-8000-000000000003"] },
];
