require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const migrationPath = path.join(
    __dirname,
    "../migrations/add_win_condition_to_prizes.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    console.log("Running migration...");
    await pool.query(sql);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
