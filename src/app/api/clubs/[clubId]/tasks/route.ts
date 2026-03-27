import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { getClubTasks, completeTask, manualTriggerReplenishment } from '@/app/clubs/[clubId]/inventory/actions';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Trigger replenishment check to ensure tasks are fresh
        try {
            await manualTriggerReplenishment(clubId);
        } catch (e) {
            console.error('Failed to trigger replenishment check:', e);
        }

        const tasks = await getClubTasks(clubId);
        return NextResponse.json({ tasks });
    } catch (error: any) {
        console.error('Get Club Tasks Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;
        const body = await request.json();
        const { taskId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!taskId) {
            return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        // completeTask handles access check internally via assertUserCanAccessClub
        await completeTask(Number(taskId), userId, clubId);
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Complete Club Task Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
