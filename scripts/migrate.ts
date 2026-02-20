import { getClient, query } from '../src/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
    console.log('Starting migration...');
    const client = await getClient();
    try {
        const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await client.query('BEGIN');
        await client.query(schemaSql);
        await client.query('COMMIT');

        console.log('Migration completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
