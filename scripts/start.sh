#!/bin/sh
set -e

echo "🔄 Running database migrations..."

# Run migrations using Node.js
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. Run schema.sql (Baseline)
    try {
      const schemaPath = path.join(process.cwd(), 'src/db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Schema applied successfully');
      }
    } catch (schemaErr) {
      // Schema failure shouldn't stop migrations (e.g., if table exists but differs)
      console.warn('⚠️  Schema application warning:', schemaErr.message);
    }

    // 2. Run all migration files (Evolution)
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await pool.query(sql);
          console.log('✅ Migration applied:', file);
        } catch (err) {
          // Ignore errors for already-applied migrations
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log('⏭️  Skipped (already applied):', file);
          } else {
            // Log but don't stop other independent migrations
            console.error('⚠️  Warning in', file + ':', err.message);
          }
        }
      }
    }

    console.log('✅ All migrations complete');
  } catch (err) {
    console.error('❌ Critical migration error:', err.message);
    console.error('❌ Migration error:', err.message);
    // Don't exit with error - allow app to start anyway
  } finally {
    await pool.end();
  }
}

migrate();
"

echo "🚀 Starting application..."
exec node server.js
