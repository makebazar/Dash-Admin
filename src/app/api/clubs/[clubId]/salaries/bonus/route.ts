import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { employee_id, amount, date, bonus_name, metric_key } = await request.json();

        if (!employee_id || !amount || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create a special "Bonus Shift"
        // We use check_in = check_out = date
        // calculated_salary = amount
        // status = 'VERIFIED' (so it counts as accrued but not necessarily paid out yet)
        // salary_snapshot stores metadata about the bonus

        const metadata = {
            type: 'PERIOD_BONUS',
            name: bonus_name,
            metric_key: metric_key,
            accrued_by: userId,
            accrued_at: new Date().toISOString()
        };

        const result = await query(
            `INSERT INTO shifts (
                user_id, 
                club_id, 
                check_in, 
                check_out, 
                total_hours, 
                calculated_salary, 
                status, 
                salary_snapshot
            ) VALUES ($1, $2, $3, $3, 0, $4, 'VERIFIED', $5)
            RETURNING id`,
            [
                employee_id,
                clubId,
                date,
                amount,
                JSON.stringify(metadata)
            ]
        );

        return NextResponse.json({ success: true, id: result.rows[0].id });

    } catch (error) {
        console.error('Bonus Accrual Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
