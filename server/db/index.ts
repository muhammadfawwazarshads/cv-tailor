import path from "node:path";
import { config } from "../config.js";

type Row = Record<string, any>;
interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

let db: Queryable;

/** Uses PostgreSQL when DATABASE_URL is set, otherwise an embedded PGlite database in DATA_DIR. */
export async function initDb() {
  if (config.databaseUrl) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
    db = pool;
    console.log("[db] connected to PostgreSQL");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = path.join(config.dataDir, "pglite");
    db = await PGlite.create(dir);
    console.log(`[db] using embedded PGlite at ${dir} (set DATABASE_URL to use PostgreSQL)`);
  }
  await migrate();
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query(text, params);
  return res.rows as T[];
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(text, params))[0];
}

const migrations: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     email text NOT NULL UNIQUE,
     name text NOT NULL DEFAULT '',
     password_hash text NOT NULL,
     role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS profiles (
     user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data jsonb NOT NULL,
     source_text text NOT NULL DEFAULT '',
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS facts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     text text NOT NULL,
     application_id uuid,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS facts_user_idx ON facts(user_id);
   CREATE TABLE IF NOT EXISTS applications (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     company text NOT NULL DEFAULT '',
     role_title text NOT NULL DEFAULT '',
     job_description text NOT NULL,
     cv_language text NOT NULL DEFAULT 'English',
     status text NOT NULL DEFAULT 'analyzing',
     analysis jsonb,
     answers jsonb NOT NULL DEFAULT '[]',
     error text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS applications_user_idx ON applications(user_id, updated_at DESC);
   CREATE TABLE IF NOT EXISTS cv_versions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     number int NOT NULL,
     label text NOT NULL DEFAULT '',
     data jsonb NOT NULL,
     notes jsonb NOT NULL DEFAULT '{}',
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS cv_versions_app_idx ON cv_versions(application_id, number);
   CREATE TABLE IF NOT EXISTS llm_providers (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text NOT NULL,
     type text NOT NULL,
     model text NOT NULL DEFAULT '',
     base_url text NOT NULL DEFAULT '',
     api_version text NOT NULL DEFAULT '',
     api_key_enc text NOT NULL DEFAULT '',
     priority int NOT NULL DEFAULT 100,
     enabled boolean NOT NULL DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS ai_usage (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES users(id) ON DELETE SET NULL,
     provider_id uuid,
     provider_name text NOT NULL DEFAULT '',
     model text NOT NULL DEFAULT '',
     task text NOT NULL,
     status text NOT NULL,
     latency_ms int NOT NULL DEFAULT 0,
     input_tokens int NOT NULL DEFAULT 0,
     output_tokens int NOT NULL DEFAULT 0,
     error text,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage(created_at DESC);
   CREATE INDEX IF NOT EXISTS ai_usage_user_idx ON ai_usage(user_id, created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS job_leads (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     data jsonb NOT NULL,
     title text NOT NULL,
     company text NOT NULL DEFAULT '',
     status text NOT NULL DEFAULT 'new',
     application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS job_leads_user_idx ON job_leads(user_id, created_at DESC);`,
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS drafts jsonb NOT NULL DEFAULT '[]'`,
  `CREATE TABLE IF NOT EXISTS personal_data (
     user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data jsonb NOT NULL DEFAULT '{}',
     signature text,
     photo text,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
];

async function migrate() {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => r.version));
  for (let i = 0; i < migrations.length; i++) {
    const version = i + 1;
    if (done.has(version)) continue;
    // PGlite and pg both accept multiple statements when no parameters are passed.
    if ("exec" in db && typeof (db as any).exec === "function") await (db as any).exec(migrations[i]);
    else await db.query(migrations[i]);
    await db.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
    console.log(`[db] applied migration ${version}`);
  }
}
