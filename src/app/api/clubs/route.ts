import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Получить все клубы владельца
        const result = await query(
            `SELECT id, name, address, created_at FROM clubs WHERE owner_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        return NextResponse.json({ clubs: result.rows });

    } catch (error) {
        console.error('Get Clubs Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
