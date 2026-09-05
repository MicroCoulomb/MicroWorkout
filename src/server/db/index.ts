import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for server data access");
}

const pool = new Pool({ connectionString, max: 10 });
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
