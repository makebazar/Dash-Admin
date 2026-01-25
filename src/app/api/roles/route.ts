import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function GET() {
    try {
        const result = await query(
            `SELECT id, name, default_kpi_settings FROM roles ORDER BY name ASC`
        );

        const roles = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            default_kpi_settings: row.default_kpi_settings
        }));

        return NextResponse.json({ roles });
    } catch (error) {
        console.error('Get Roles Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
