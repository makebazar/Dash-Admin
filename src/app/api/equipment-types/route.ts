import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET - Get equipment types list
export async function GET() {
    try {
        const result = await query(
            `SELECT * FROM equipment_types ORDER BY sort_order, name_ru`
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Equipment Types Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
