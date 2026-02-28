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
        const { template_id, employee_id, responses, comments, shift_id, target_user_id } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let targetUserId = target_user_id;

        if (!targetUserId) {
            // Validate employee_id
            if (!employee_id) {
                // If neither target_user_id nor employee_id is provided
                // Maybe it's a self-evaluation or shift opening checklist?
                // If it's a shift opening checklist (handover), and no previous employee found, maybe link to self or just club?
                // For now, require ID.
                return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
            }

            // Fetch user_id for the employee_id
            const employeeUserRes = await query(
                `SELECT user_id FROM club_employees WHERE id = $1 AND club_id = $2`,
                [employee_id, clubId]
            );

            if (employeeUserRes.rowCount === 0) {
                return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
            }
            targetUserId = employeeUserRes.rows[0].user_id;
        }

        // Check access (Manager check - typically owners or managers can evaluate)
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
        // We calculate score based on the actual score provided (0 to weight)
        // totalPoints = sum(score)
        // maxPossiblePoints = sum(weight)

        for (const resp of responses) {
            const weight = Number(itemsMap.get(resp.item_id)) || 1;
            // The score is already in points (e.g. 5, 4, 3...)
            totalPoints += (Number(resp.score) || 0);
            maxPossiblePoints += weight;
        }

        // We store the RAW score, not percentage. Percentage is calculated on display.
        const totalScore = totalPoints;

        await query('BEGIN');

        const evalResult = await query(
            `INSERT INTO evaluations (club_id, template_id, employee_id, evaluator_id, total_score, max_score, comments, shift_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [clubId, template_id, targetUserId, userId, totalScore, maxPossiblePoints, comments || '', shift_id || null]
        );
        const evaluationId = evalResult.rows[0].id;

        for (const resp of responses) {
            await query(
                `INSERT INTO evaluation_responses (evaluation_id, item_id, score, comment, photo_url, photo_urls)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    evaluationId, 
                    resp.item_id, 
                    resp.score, 
                    resp.comment, 
                    (resp.photo_urls && resp.photo_urls.length > 0) ? resp.photo_urls[0] : (resp.photo_url || null),
                    resp.photo_urls || (resp.photo_url ? [resp.photo_url] : [])
                ]
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
