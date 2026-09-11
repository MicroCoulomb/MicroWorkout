ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "issuer" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "display_name" text;--> statement-breakpoint
UPDATE "user_profiles" AS "profile"
SET "display_name" = COALESCE(
	(
		SELECT NULLIF("change"."payload"->>'name', '')
		FROM "sync_changes" AS "change"
		WHERE "change"."user_id" = "profile"."user_id"
			AND "change"."entity_type" = 'profile'
			AND "change"."operation" = 'upsert'
		ORDER BY "change"."cursor" DESC
		LIMIT 1
	),
	"user"."name",
	'Athlete'
)
FROM "users" AS "user"
WHERE "user"."id" = "profile"."user_id";--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "display_name" SET DEFAULT 'Athlete';--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "display_name" SET NOT NULL;
