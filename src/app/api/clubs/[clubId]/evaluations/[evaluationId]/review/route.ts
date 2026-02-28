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
        const { status, reviewer_note, items } = await request.json();

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
        if (items && Array.isArray(items)) {
            for (const item of items) {
                await query(
                    `UPDATE evaluation_responses 
                     SET is_accepted = $1, admin_comment = $2
                     WHERE id = $3 AND evaluation_id = $4`,
                    [item.is_accepted, item.admin_comment, item.response_id, evaluationId]
                );
            }
        }

        // 2. Recalculate Total Score based on updated responses
        // We need to fetch all responses for this evaluation and their weights from the template
        const calcResult = await query(
            `
            SELECT 
                r.score, 
                r.is_accepted,
                t.weight
            FROM evaluation_responses r
            JOIN evaluations e ON r.evaluation_id = e.id
            JOIN evaluation_template_items t ON r.item_id = t.id
            WHERE e.id = $1
            `,
            [evaluationId]
        );

        let totalPoints = 0;
        let maxPossiblePoints = 0;

        for (const row of calcResult.rows) {
            const weight = Number(row.weight) || 1;
            // Only count score if accepted
            if (row.is_accepted) {
                totalPoints += (Number(row.score) || 0) * weight;
            }
            // Max possible points remains the same (we judge against the perfect execution)
            maxPossiblePoints += 1 * weight; 
        }

        const newTotalScore = maxPossiblePoints > 0 ? (totalPoints / maxPossiblePoints) * 100 : 0;

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
