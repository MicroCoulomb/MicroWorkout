ALTER TABLE "exercises" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
UPDATE "exercises" SET "created_by_user_id" = "user_id" WHERE "user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "normalized_name" text;--> statement-breakpoint
UPDATE "exercises" SET "normalized_name" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'));--> statement-breakpoint
CREATE TABLE "exercise_aliases" ("id" uuid PRIMARY KEY NOT NULL, "canonical_id" uuid NOT NULL);--> statement-breakpoint
WITH ranked AS (
  SELECT "id", first_value("id") OVER (PARTITION BY "normalized_name" ORDER BY "builtin" DESC, "created_at", "id") AS canonical_id
  FROM "exercises"
)
INSERT INTO "exercise_aliases" ("id", "canonical_id")
SELECT "id", canonical_id FROM ranked WHERE "id" <> canonical_id;--> statement-breakpoint
UPDATE "workout_plan_exercises" AS relation SET "exercise_id" = alias."canonical_id" FROM "exercise_aliases" AS alias WHERE relation."exercise_id" = alias."id";--> statement-breakpoint
UPDATE "session_exercises" AS exercise SET "source_exercise_id" = alias."canonical_id" FROM "exercise_aliases" AS alias WHERE exercise."source_exercise_id" = alias."id";--> statement-breakpoint
DELETE FROM "exercises" AS exercise USING "exercise_aliases" AS alias WHERE exercise."id" = alias."id";--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "normalized_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "exercises" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_aliases" ADD CONSTRAINT "exercise_aliases_canonical_id_exercises_id_fk" FOREIGN KEY ("canonical_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "exercises_owner_idx";--> statement-breakpoint
CREATE INDEX "exercises_creator_idx" ON "exercises" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_normalized_name_unique" ON "exercises" USING btree ("normalized_name");
