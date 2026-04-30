import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { freezeClubEmployeeLeaderboard, getClubEmployeeLeaderboardState } from '@/lib/employee-leaderboard';
import { requireClubFullAccess } from '@/lib/club-api-access';

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

        await requireClubFullAccess(String(clubId));

        const { searchParams } = new URL(request.url);
        const now = new Date();
        const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
        const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);

        const { leaderboard, meta } = await getClubEmployeeLeaderboardState(clubId, year, month);

        return NextResponse.json({
            month,
            year,
            meta,
            top: leaderboard.slice(0, 10)
        });
    } catch (error: any) {
        console.error('Get Leaderboard Error:', error);
        const status = typeof error?.status === 'number' ? error.status : 500
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await requireClubFullAccess(String(clubId));

        const body = await request.json().catch(() => ({}));
        const now = new Date();
        const month = parseInt(body?.month || String(now.getMonth() + 1), 10);
        const year = parseInt(body?.year || String(now.getFullYear()), 10);

        const result = await freezeClubEmployeeLeaderboard(clubId, year, month);

        return NextResponse.json({
            success: true,
            month,
            year,
            meta: result.meta,
            top: result.leaderboard.slice(0, 10)
        });
    } catch (error: any) {
        console.error('Freeze Leaderboard Error:', error);
        const status = typeof error?.status === 'number' ? error.status : 500
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status });
    }
}
