import { z } from "zod";

const exerciseSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(120),
  muscleGroup: z.enum(["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes"]),
  equipment: z.enum(["Bodyweight", "Dumbbells"]), builtin: z.boolean(), updatedAt: z.number(),
});

const planSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(80), restSeconds: z.number().int().min(0).max(3600),
  exerciseIds: z.array(z.uuid()).min(1).max(100), updatedAt: z.number(),
});

const profileSchema = z.object({
  id: z.literal("profile"), name: z.string().trim().min(1).max(100), weightUnit: z.enum(["kg", "lb"]),
  weeklyGoal: z.number().int().min(1).max(7), timezone: z.string().min(1).max(100), lastVerifiedAt: z.number(),
});

const setSchema = z.object({ id: z.uuid(), reps: z.number().int().positive(), weightKg: z.number().positive().nullable(), completedAt: z.number() });
const sessionExerciseSchema = z.object({
  id: z.uuid(), sourceExerciseId: z.uuid(), name: z.string().min(1).max(120),
  muscleGroup: z.string().min(1).max(50), equipment: z.string().min(1).max(50),
  status: z.enum(["pending", "completed", "skipped"]), sets: z.array(setSchema),
});
const restStateSchema = z.object({ id: z.uuid(), setId: z.uuid(), originalStartedAt: z.number(), startedAt: z.number(), endsAt: z.number(), accumulatedMs: z.number().nonnegative(), remainingMs: z.number().nonnegative().optional() });
const restLogSchema = z.object({ id: z.uuid(), setId: z.uuid(), startedAt: z.number(), targetEndedAt: z.number(), endedAt: z.number(), actualMs: z.number().nonnegative(), endReason: z.enum(["elapsed", "skip", "finish"]) });

const sessionSchema = z.object({
  id: z.uuid(), deviceId: z.string().min(1).max(100), planId: z.uuid(), planName: z.string().min(1).max(80),
  restSeconds: z.number().int().min(0).max(3600), status: z.enum(["active", "paused", "completed", "completed_early"]),
  exercises: z.array(sessionExerciseSchema).min(1).max(100), currentExerciseIndex: z.number().int().nonnegative(),
  startedAt: z.number(), endedAt: z.number().optional(), pausedAt: z.number().optional(), pausedMs: z.number().int().nonnegative(),
  restMs: z.number().int().nonnegative(), rest: restStateSchema.optional(), rests: z.array(restLogSchema), updatedAt: z.number(),
});

export const payloadSchemas = { exercise: exerciseSchema, plan: planSchema, profile: profileSchema, session: sessionSchema };

export const syncRequestSchema = z.object({
  cursor: z.number().int().nonnegative().default(0),
  mutations: z.array(z.object({
    id: z.uuid(), entityType: z.enum(["plan", "exercise", "session", "profile"]),
    entityId: z.string().min(1), operation: z.enum(["upsert", "delete"]), payload: z.unknown().optional(), createdAt: z.number(),
  })).max(250).default([]),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;
