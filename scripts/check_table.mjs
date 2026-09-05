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
    const res = await client.query("select to_regclass('public.verifications') as tbl");
    console.log(res.rows);
    await client.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
