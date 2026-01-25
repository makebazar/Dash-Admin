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

export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, address } = await request.json();

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Club name is required' }, { status: 400 });
        }

        // Создать новый клуб
        const result = await query(
            `INSERT INTO clubs (name, address, owner_id) VALUES ($1, $2, $3) RETURNING id, name, address, created_at`,
            [name.trim(), address?.trim() || null, userId]
        );

        return NextResponse.json({ club: result.rows[0] });

    } catch (error) {
        console.error('Create Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
