const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    console.log('🚀 Starting database migration (CommonJS)...');

    // Create a pool using DATABASE_URL from environment
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Optional: Add SSL config if needed for production
        // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        const client = await pool.connect();
        
        try {
            // 1. Apply Base Schema (Idempotent check inside SQL usually, but we check file existence)
            console.log('📦 Checking base schema...');
            const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                // We run schema outside of transaction or handle errors gracefully because
                // schema.sql might contain CREATE TABLE without IF NOT EXISTS in some legacy code.
                // But ideally schema.sql should be robust.
                // For safety, we wrap in try-catch and log warning if it fails, assuming tables exist.
                try {
                    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                    await client.query('BEGIN');
                    await client.query(schemaSql);
                    await client.query('COMMIT');
                    console.log('  ✅ Base schema applied/verified.');
                } catch (schemaErr) {
                    await client.query('ROLLBACK');
                    console.warn('  ⚠️  Base schema application warning (might already exist):', schemaErr.message);
                }
            } else {
                console.warn('  ⚠️  Base schema file not found at src/db/schema.sql');
            }

            // 2. Ensure _migrations table exists
            await client.query('BEGIN');
            await client.query(`
                CREATE TABLE IF NOT EXISTS _migrations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP DEFAULT NOW()
                );
            `);
            await client.query('COMMIT');

            // 3. Get applied migrations
            const { rows: appliedMigrations } = await client.query('SELECT name FROM _migrations');
            const appliedNames = new Set(appliedMigrations.map(m => m.name));

            // 4. Read migration files
            const migrationsDir = path.join(process.cwd(), 'migrations');
            if (fs.existsSync(migrationsDir)) {
                const files = fs.readdirSync(migrationsDir)
                    .filter(f => f.endsWith('.sql'))
                    .sort(); // Sort by name to ensure order

                if (files.length > 0) {
                    console.log(`🔄 Found ${files.length} migration files.`);
                    
                    let appliedCount = 0;
                    for (const file of files) {
                        if (appliedNames.has(file)) {
                            continue; 
                        }

                        // Check if a specific migration file was requested via command line args
                        // Usage: node scripts/migrate.js my_migration.sql
                        const targetMigration = process.argv[2];
                        if (targetMigration && file !== targetMigration) {
                            continue;
                        }

                        console.log(`  ➜ Applying migration: ${file}`);
                        const migrationPath = path.join(migrationsDir, file);
                        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

                        try {
                            await client.query('BEGIN');
                            await client.query(migrationSql);
                            await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
                            await client.query('COMMIT');
                            console.log(`  ✅ Applied: ${file}`);
                            appliedCount++;
                        } catch (err) {
                            await client.query('ROLLBACK');
                            
                            // Check for "already exists" errors to make migrations more robust against messy history
                            // 42701: duplicate_column
                            // 42P07: duplicate_table / relation_already_exists
                            // 42710: duplicate_object (constraint)
                            // 42P06: duplicate_schema
                            if (['42701', '42P07', '42710', '42P06'].includes(err.code)) {
                                console.warn(`  ⚠️  Skipping ${file} because it seems already applied (Error: ${err.code} - ${err.message})`);
                                // Mark as applied so we don't try again
                                try {
                                    await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
                                    console.log(`  ✅ Marked ${file} as applied (skipped execution).`);
                                    appliedCount++;
                                } catch (markErr) {
                                    console.error(`  ❌ Failed to mark ${file} as applied:`, markErr);
                                }
                                continue;
                            }

                            console.error(`  ❌ Failed to apply ${file}:`, err);
                            throw err; // Stop migration on failure
                        }
                    }
                    
                    if (appliedCount === 0) {
                        console.log('  ✨ No new migrations to apply.');
                    }
                } else {
                    console.log('  ✨ No migration files found in migrations folder.');
                }
            } else {
                console.log('  ⚠️  Migrations directory not found at ./migrations');
            }

            console.log('✨ Database migration completed successfully.');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('🔥 Migration process failed:', err);
        // We exit with 0 to NOT crash the container restart loop if DB is temporarily unavailable,
        // but typically for migration failure we might want to crash. 
        // Given start.sh logic, we probably want to proceed or retry.
        // For now, exit 1 to signal failure.
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
