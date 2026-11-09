import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireClubFullAccess } from '@/lib/club-api-access';
import { recalculateClubMaintenanceBonuses } from '@/lib/maintenance-task-logic';

export const dynamic = 'force-dynamic';

// POST /api/clubs/[clubId]/equipment/maintenance/recalculate-bonuses
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const adminUserId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!adminUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await requireClubFullAccess(clubId);

        const { searchParams } = new URL(request.url);
        const now = new Date();
        const month = parseInt(searchParams.get('month') || (now.getMonth() + 1).toString());
        const year = parseInt(searchParams.get('year') || now.getFullYear().toString());

        const updatedCount = await recalculateClubMaintenanceBonuses({
            clubId,
            month,
            year,
        });

        if (updatedCount === 0) {
            return NextResponse.json({ 
                success: true, 
                message: 'Нет выполненных задач для перерасчета в этом месяце.', 
                updated_count: 0 
            });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Перерасчет завершен. Обновлено задач: ${updatedCount}.`, 
            updated_count: updatedCount 
        });

    } catch (error: any) {
        console.error('Recalculate Bonuses Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

