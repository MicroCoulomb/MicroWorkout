ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "issuer" text;
CREATE INDEX IF NOT EXISTS "accounts_issuer_idx" ON "accounts" USING btree ("issuer");
