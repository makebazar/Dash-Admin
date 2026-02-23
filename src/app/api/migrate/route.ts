import { NextResponse } from 'next/server';
import { query } from '@/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sqlPath = path.join(process.cwd(), 'migrations', 'add_club_instructions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            await query(statement);
        }
        
        return NextResponse.json({ success: true, message: `Executed ${statements.length} statements` });
    } catch (error) {
        console.error('Migration Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
