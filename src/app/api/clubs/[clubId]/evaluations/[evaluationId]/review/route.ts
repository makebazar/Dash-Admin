import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; evaluationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, evaluationId } = await params;
        const { status, reviewer_note, items, item_reviews } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership/manager role
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2 AND role IN ('admin', 'manager')`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await query('BEGIN');

        // 1. Update individual response items (accept/reject)
        const updates = Array.isArray(item_reviews) ? item_reviews : items
        if (updates && Array.isArray(updates)) {
            for (const item of updates) {
                const adjustedScore = item.adjusted_score
                await query(
                    `UPDATE evaluation_responses 
                     SET is_accepted = $1, admin_comment = $2, score = COALESCE($3, score)
                     WHERE id = $4 AND evaluation_id = $5`,
                    [
                        item.is_accepted,
                        item.admin_comment || null,
                        adjustedScore !== undefined && adjustedScore !== null ? adjustedScore : null,
                        item.response_id,
                        evaluationId
                    ]
                );
            }
        }

        const scoreResult = await query(
            `SELECT COALESCE(SUM(score), 0) AS total_score FROM evaluation_responses WHERE evaluation_id = $1`,
            [evaluationId]
        );
        const newTotalScore = Number(scoreResult.rows[0]?.total_score || 0);

        // 3. Update evaluation status and score
        await query(
            `UPDATE evaluations 
             SET status = $1, 
                 reviewer_note = $2, 
                 total_score = $3,
                 reviewed_at = NOW(),
                 reviewed_by = $4
             WHERE id = $5 AND club_id = $6`,
            [status, reviewer_note, newTotalScore, userId, evaluationId, clubId]
        );

        await query('COMMIT');

        return NextResponse.json({ success: true, new_score: newTotalScore });

    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Review Evaluation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
