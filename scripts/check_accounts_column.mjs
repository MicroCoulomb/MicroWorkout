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
    const res = await client.query("select column_name from information_schema.columns where table_name='accounts' and column_name = 'issuer'");
    console.log(res.rows);
    await client.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
