#!/bin/sh
set -e

echo "🔄 Running database migrations..."

node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function migrate() {
  if (process.env.SKIP_DB_MIGRATIONS === 'true') {
    console.log('⏭️  SKIP_DB_MIGRATIONS=true, skipping migration step');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    \`);

    const tablesResult = await pool.query(\`
      SELECT COUNT(*)::int AS count
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'schema_migrations';
    \`);
    const publicTablesCount = tablesResult.rows[0]?.count ?? 0;

    if (publicTablesCount === 0) {
      const schemaPath = path.join(process.cwd(), 'src/db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Baseline schema applied');
      }
    } else {
      console.log('ℹ️  Schema already initialized, skipping baseline schema.sql');
    }

    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');

        const existing = await pool.query(
          'SELECT checksum FROM schema_migrations WHERE name = $1',
          [file]
        );

        if (existing.rowCount > 0) {
          const appliedChecksum = existing.rows[0].checksum;
          if (appliedChecksum !== checksum) {
            console.error('⚠️  Migration changed after apply:', file);
            continue;
          }
          console.log('⏭️  Already applied:', file);
          continue;
        }

        try {
          await pool.query('BEGIN');
          await pool.query(sql);
          await pool.query(
            'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
            [file, checksum]
          );
          await pool.query('COMMIT');
          console.log('✅ Migration applied:', file);
        } catch (err) {
          await pool.query('ROLLBACK');
          console.error('⚠️  Warning in', file + ':', err.message);
        }
      }
    }

    console.log('✅ All migrations complete');
  } catch (err) {
    console.error('❌ Critical migration error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
"

echo "🚀 Starting application..."
exec node server.js
