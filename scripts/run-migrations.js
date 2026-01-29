#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database');

        // Get list of migration files
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Execute in alphabetical order

        console.log(`📁 Found ${files.length} migration files`);

        // Create migrations tracking table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename VARCHAR(255) PRIMARY KEY,
                executed_at TIMESTAMP DEFAULT NOW()
            )
        `);

        for (const file of files) {
            // Check if migration was already executed
            const result = await client.query(
                'SELECT 1 FROM schema_migrations WHERE filename = $1',
                [file]
            );

            if (result.rows.length > 0) {
                console.log(`⏭️  Skipping ${file} (already executed)`);
                continue;
            }

            // Read and execute migration
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            console.log(`🚀 Executing migration: ${file}`);
            await client.query(sql);

            // Mark as executed
            await client.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1)',
                [file]
            );

            console.log(`✅ Completed: ${file}`);
        }

        console.log('✨ All migrations completed successfully');
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        await client.end();
    }
}

runMigrations().catch(err => {
    console.error('Failed to run migrations:', err);
    process.exit(1);
});
