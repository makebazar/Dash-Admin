#!/bin/sh
set -e

echo "🔄 Running database migrations..."

# Run migrations using Node.js with proper tracking
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Create migrations tracking table
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    \`);
    console.log('📋 Migration tracking table ready');

    // 1. Run schema.sql if needed (Baseline)
    try {
      const schemaPath = path.join(process.cwd(), 'src/db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Schema applied successfully');
      }
    } catch (schemaErr) {
      // Schema failure shouldn't stop migrations
      console.warn('⚠️  Schema application warning:', schemaErr.message);
    }

    // 2. Run migration files with tracking
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of files) {
        // Check if already executed
        const result = await pool.query(
          'SELECT 1 FROM schema_migrations WHERE filename = \$1',
          [file]
        );

        if (result.rows.length > 0) {
          console.log('⏭️  Skipped', file, '(already executed)');
          continue;
        }

        // Execute migration
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await pool.query(sql);
          
          // Mark as executed
          await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES (\$1)',
            [file]
          );
          
          console.log('✅ Migration applied:', file);
        } catch (err) {
          console.error('❌ Error in', file + ':', err.message);
          // Stop on error to prevent partial migrations
          throw err;
        }
      }
    }

    console.log('✅ All migrations complete');
  } catch (err) {
    console.error('❌ Critical migration error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
"

echo "🚀 Starting application..."
exec node server.js
