import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string, evaluationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, evaluationId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Access check
        const accessCheck = await query(
            `
            SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
            UNION
            SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
            `,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get Evaluation Details
        const evaluationResult = await query(
            `
            SELECT e.*, t.name as template_name, u.full_name as employee_name, ev.full_name as evaluator_name
            FROM evaluations e
            JOIN evaluation_templates t ON e.template_id = t.id
            JOIN users u ON e.employee_id = u.id
            LEFT JOIN users ev ON e.evaluator_id = ev.id
            WHERE e.id = $1 AND e.club_id = $2
            `,
            [evaluationId, clubId]
        );

        if (evaluationResult.rowCount === 0) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }

        const evaluation = evaluationResult.rows[0];

        // Get Responses with Item Details
        const responsesResult = await query(
            `
            SELECT 
                r.id,
                r.score,
                r.comment,
                r.photo_url,
                r.photo_urls,
                i.content as item_content,
                i.description,
                i.weight
            FROM evaluation_responses r
            JOIN evaluation_template_items i ON r.item_id = i.id
            WHERE r.evaluation_id = $1
            ORDER BY i.sort_order ASC
            `,
            [evaluationId]
        );

        return NextResponse.json({
            ...evaluation,
            responses: responsesResult.rows
        });

    } catch (error) {
        console.error('Get Evaluation Detail Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
