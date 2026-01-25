import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Получить клуб и проверить владельца
        const result = await query(
            `SELECT id, name, address, owner_id, created_at FROM clubs WHERE id = $1`,
            [clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = result.rows[0];

        // Проверить, что пользователь - владелец
        if (club.owner_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ club });

    } catch (error) {
        console.error('Get Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
