import { NextResponse } from 'next/server';
import { query } from '@/db';
import { requireClubApiAccess } from '@/lib/club-api-access';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        await requireClubApiAccess(clubId);

        // Получить клуб и проверить владельца
        const result = await query(
            `SELECT id, name, address, owner_id, created_at FROM clubs WHERE id = $1`,
            [clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = result.rows[0];

        return NextResponse.json({ club });

    } catch (error: any) {
        const status = error?.status;
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
        }
        console.error('Get Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
