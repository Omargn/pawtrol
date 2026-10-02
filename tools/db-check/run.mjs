// Applies supabase/migrations and seed.sql (as `supabase db start` does in CI) to an in-memory
// PGlite with a minimal Supabase shim, then runs every pgTAP file in
// supabase/tests/database. Exits non-zero on any failure.
//
// It exists because contributors can't always run Docker. It is an
// approximation — the shim is not Supabase — so CI, which runs the real stack,
// stays the source of truth.
//
//   npm run check               migrations + seed + tests
//   npm run check -- --no-seed  skip seed.sql
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { postgis } from "@electric-sql/pglite-postgis";
import { pgtap } from "@electric-sql/pglite-pgtap";

const here = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(here, "..", "..", "supabase");
const withSeed = !process.argv.includes("--no-seed");

const sqlFiles = (dir, suffix) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));

// pg_cron can't load in PGlite; the shim provides cron.schedule instead.
const adaptMigration = (sql) => sql.replace(/^create extension if not exists pg_cron.*$/gim, "-- (pg_cron: shimmed)");

const db = await PGlite.create({ extensions: { pgcrypto, postgis, pgtap } });
await db.exec(readFileSync(join(here, "supabase-shim.sql"), "utf8"));
// Supabase's search_path for the postgres role.
await db.exec(`set search_path = "$user", public, extensions;`);

let failed = false;

for (const { name, sql } of sqlFiles(join(supabaseDir, "migrations"), ".sql")) {
  try {
    await db.exec(adaptMigration(sql));
    console.log(`migrated  ${name}`);
  } catch (error) {
    console.error(`FAILED    ${name}\n  ${error.message}`);
    process.exit(1);
  }
}

if (withSeed) {
  try {
    await db.exec(readFileSync(join(supabaseDir, "seed.sql"), "utf8"));
    console.log("seeded    seed.sql");
  } catch (error) {
    console.error(`FAILED    seed.sql\n  ${error.message}`);
    process.exit(1);
  }
}

for (const { name, sql } of sqlFiles(join(supabaseDir, "tests", "database"), ".test.sql")) {
  let lines;
  try {
    const results = await db.exec(sql);
    lines = results.flatMap((result) => result.rows.map((row) => String(Object.values(row)[0])));
  } catch (error) {
    console.error(`ERROR     ${name}\n  ${error.message}`);
    await db.exec("rollback;").catch(() => {});
    failed = true;
    continue;
  }

  const tap = lines.filter((line) => /^(ok|not ok|1\.\.|#)/.test(line));
  const notOk = tap.filter((line) => line.startsWith("not ok") || /# Looks like/.test(line));
  const passed = tap.filter((line) => line.startsWith("ok")).length;
  if (notOk.length > 0) {
    failed = true;
    console.error(`FAILED    ${name} (${passed} passed)`);
    for (const line of tap.filter((l) => l.startsWith("not ok") || l.startsWith("#"))) console.error(`  ${line}`);
  } else {
    console.log(`passed    ${name} (${passed} assertions)`);
  }
}

await db.close();
process.exit(failed ? 1 : 0);
