import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { getShiftAccountabilitySetupStatus } from '@/app/clubs/[clubId]/inventory/actions';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `
            SELECT 1
            FROM club_employees
            WHERE club_id = $1 AND user_id = $2 AND is_active = true
            UNION
            SELECT 1
            FROM clubs
            WHERE id = $1 AND owner_id = $2
            LIMIT 1
            `,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const status = await getShiftAccountabilitySetupStatus(clubId);
        return NextResponse.json(status);
    } catch (error) {
        console.error('Get Shift Accountability Status Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
