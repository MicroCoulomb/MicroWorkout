import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  ...timestamps,
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  issuer: text("issuer"),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
}, (table) => [index("accounts_user_idx").on(table.userId)]);

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
  ...timestamps,
}, (table) => [index("auth_sessions_user_idx").on(table.userId)]);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [index("verifications_identifier_idx").on(table.identifier)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull(),
  status: text("status").notNull().default("pending"),
  invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  acceptedByUserId: text("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [uniqueIndex("invitations_email_unique").on(table.email)]);

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default("Athlete"),
  weightUnit: text("weight_unit").notNull().default("kg"),
  weeklyGoal: integer("weekly_goal").notNull().default(3),
  timezone: text("timezone").notNull().default("UTC"),
  ...timestamps,
});

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  slug: text("slug"),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  muscleGroup: text("muscle_group").notNull(),
  equipment: text("equipment").notNull(),
  builtin: boolean("builtin").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("exercises_creator_idx").on(table.createdByUserId), uniqueIndex("exercises_builtin_slug_unique").on(table.slug), uniqueIndex("exercises_normalized_name_unique").on(table.normalizedName)]);

export const exerciseAliases = pgTable("exercise_aliases", {
  id: uuid("id").primaryKey(),
  canonicalId: uuid("canonical_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
});

export const workoutPlans = pgTable("workout_plans", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  restSeconds: integer("rest_seconds").notNull().default(60),
  revision: integer("revision").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("workout_plans_owner_idx").on(table.userId)]);

export const workoutPlanExercises = pgTable("workout_plan_exercises", {
  id: uuid("id").primaryKey(),
  planId: uuid("plan_id").notNull().references(() => workoutPlans.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
}, (table) => [index("plan_exercises_plan_idx").on(table.planId)]);

export const workoutSessions = pgTable("workout_sessions", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  sourcePlanId: uuid("source_plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
  planName: text("plan_name").notNull(),
  restSeconds: integer("rest_seconds").notNull(),
  status: text("status").notNull(),
  currentExerciseIndex: integer("current_exercise_index").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  pausedMs: integer("paused_ms").notNull().default(0),
  restMs: integer("rest_ms").notNull().default(0),
  activeState: jsonb("active_state"),
  revision: integer("revision").notNull().default(1),
  ...timestamps,
}, (table) => [index("workout_sessions_owner_started_idx").on(table.userId, table.startedAt)]);

export const sessionExercises = pgTable("session_exercises", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  sourceExerciseId: uuid("source_exercise_id"),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group").notNull(),
  equipment: text("equipment").notNull(),
  status: text("status").notNull(),
  position: integer("position").notNull(),
}, (table) => [index("session_exercises_session_idx").on(table.sessionId)]);

export const exerciseSets = pgTable("exercise_sets", {
  id: uuid("id").primaryKey(),
  sessionExerciseId: uuid("session_exercise_id").notNull().references(() => sessionExercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  reps: integer("reps").notNull(),
  weightKg: numeric("weight_kg", { precision: 10, scale: 3 }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
}, (table) => [index("exercise_sets_exercise_idx").on(table.sessionExerciseId)]);

export const restIntervals = pgTable("rest_intervals", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  setId: uuid("set_id").notNull().references(() => exerciseSets.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  targetEndedAt: timestamp("target_ended_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  actualMs: integer("actual_ms"),
  endReason: text("end_reason"),
}, (table) => [index("rest_intervals_session_idx").on(table.sessionId)]);

export const syncMutations = pgTable("sync_mutations", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sync_mutations_owner_idx").on(table.userId)]);

export const syncChanges = pgTable("sync_changes", {
  cursor: integer("cursor").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  operation: text("operation").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sync_changes_owner_cursor_idx").on(table.userId, table.cursor)]);
