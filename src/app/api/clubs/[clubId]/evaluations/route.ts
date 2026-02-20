import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employee_id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check access
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

        let queryStr = `
            SELECT e.*, t.name as template_name, u.full_name as employee_name, ev.full_name as evaluator_name
            FROM evaluations e
            JOIN evaluation_templates t ON e.template_id = t.id
            JOIN users u ON e.employee_id = u.id
            LEFT JOIN users ev ON e.evaluator_id = ev.id
            WHERE e.club_id = $1
        `;
        const queryParams: any[] = [clubId];

        if (employeeId) {
            queryStr += ` AND e.employee_id = $2`;
            queryParams.push(employeeId);
        }

        queryStr += ` ORDER BY e.evaluation_date DESC`;

        const result = await query(queryStr, queryParams);
        return NextResponse.json(result.rows);

    } catch (error) {
        console.error('Get Evaluations Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { template_id, employee_id, responses, comments } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check access (Manager check - typically owners or managers can evaluate)
        // For now, let's assume any club member with access can evaluate, or just owners.
        // Usually, managers evaluate. Let's stick to club member check for now.
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

        // Get template items to calculate max score
        const itemsResult = await query(
            `SELECT id, weight FROM evaluation_template_items WHERE template_id = $1`,
            [template_id]
        );
        const itemsMap = new Map(itemsResult.rows.map(i => [i.id, i.weight]));

        let totalPoints = 0;
        let maxPossiblePoints = 0;

        // Responses is an array of { item_id, score, comment }
        // Assume score is 0-1 (Yes/No) or some scale. 
        // Let's assume max score per item is 1 for now (binary check) or 5 if scale.
        // Front-end should provide the score.
        // For simplicity, let's assume binary (0/1) if not specified, but let's support up to 100 for percentage items.

        for (const resp of responses) {
            const weight = Number(itemsMap.get(resp.item_id)) || 1;
            totalPoints += (Number(resp.score) || 0) * weight;
            maxPossiblePoints += 1 * weight; // Assuming 1 is the reference max per item
        }

        const totalScore = maxPossiblePoints > 0 ? (totalPoints / maxPossiblePoints) * 100 : 0;

        await query('BEGIN');

        const evalResult = await query(
            `INSERT INTO evaluations (club_id, template_id, employee_id, evaluator_id, total_score, max_score, comments)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [clubId, template_id, employee_id, userId, totalScore, 100, comments]
        );
        const evaluationId = evalResult.rows[0].id;

        for (const resp of responses) {
            await query(
                `INSERT INTO evaluation_responses (evaluation_id, item_id, score, comment, photo_url)
                 VALUES ($1, $2, $3, $4, $5)`,
                [evaluationId, resp.item_id, resp.score, resp.comment, resp.photo_url || null]
            );
        }

        await query('COMMIT');

        return NextResponse.json({ success: true, id: evaluationId, score: totalScore });

    } catch (error) {
        await query('ROLLBACK');
        console.error('Submit Evaluation Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
