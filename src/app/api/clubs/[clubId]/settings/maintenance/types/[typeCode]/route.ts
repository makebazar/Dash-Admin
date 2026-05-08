import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; typeCode: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, typeCode } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        await query(
            `DELETE FROM club_equipment_type_maintenance_settings
             WHERE club_id = $1 AND equipment_type_code = $2`,
            [clubId, typeCode]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Type Maintenance Settings Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
