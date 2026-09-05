import { Client } from 'pg';
(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "issuer" text');
    await client.query('CREATE INDEX IF NOT EXISTS "accounts_issuer_idx" ON "accounts" USING btree ("issuer")');
    const res = await client.query("select column_name from information_schema.columns where table_name='accounts' and column_name = 'issuer'");
    console.log('issuer column present:', res.rows.length > 0);
    await client.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
