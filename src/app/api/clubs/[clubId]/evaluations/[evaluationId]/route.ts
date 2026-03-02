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
            SELECT e.*, t.name as template_name, u.full_name as employee_name, ev.full_name as evaluator_name, rv.full_name as reviewer_name
            FROM evaluations e
            JOIN evaluation_templates t ON e.template_id = t.id
            JOIN users u ON e.employee_id = u.id
            LEFT JOIN users ev ON e.evaluator_id = ev.id
            LEFT JOIN users rv ON e.reviewed_by = rv.id
            WHERE e.id = $1 AND e.club_id = $2
            `,
            [evaluationId, clubId]
        );

        if (evaluationResult.rowCount === 0) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }

        const evaluation = evaluationResult.rows[0];

        // Get all workstations for this club to calculate max scores
        const workstationsResult = await query(
            `SELECT id, zone, is_active FROM club_workstations WHERE club_id = $1`,
            [clubId]
        );
        const workstations = workstationsResult.rows;

        // Get Responses with Item Details
        const responsesResult = await query(
            `
            SELECT 
                r.id,
                r.score,
                r.comment,
                r.photo_url,
                r.photo_urls,
                r.selected_workstations,
                r.admin_comment,
                i.content as item_content,
                i.description,
                i.weight as max_score,
                i.options,
                i.related_entity_type,
                i.target_zone
            FROM evaluation_responses r
            JOIN evaluation_template_items i ON r.item_id = i.id
            WHERE r.evaluation_id = $1
            ORDER BY i.sort_order ASC
            `,
            [evaluationId]
        );

        const responses = responsesResult.rows.map((row: any) => {
            if (row.related_entity_type === 'workstations') {
                const hasSelectedWorkstations = Array.isArray(row.selected_workstations) && row.selected_workstations.length > 0
                const commentHasIssues = typeof row.comment === 'string' && (row.comment.startsWith('Проблемы: ') || row.comment.startsWith('Проблемные: '))
                return { 
                    ...row, 
                    max_score: 10,
                    score: (Number(row.score) === 0 && !hasSelectedWorkstations && !commentHasIssues) 
                        ? 10 
                        : Number(row.score)
                };
            }
            return row;
        });

        return NextResponse.json({
            ...evaluation,
            responses
        });

    } catch (error) {
        console.error('Get Evaluation Detail Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string, evaluationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, evaluationId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await query(
            `DELETE FROM evaluations WHERE id = $1 AND club_id = $2`,
            [evaluationId, clubId]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete Evaluation Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
