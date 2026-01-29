import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/settings/finance/mappings
export async function GET(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;

        // Get mappings with payment method and account details
        const result = await query(
            `SELECT 
                fam.id,
                fam.payment_method_id,
                pm.code as payment_method_code,
                pm.label as payment_method_label,
                pm.icon as payment_method_icon,
                pm.is_system,
                fam.account_id,
                fa.name as account_name,
                fa.icon as account_icon,
                fa.color as account_color
             FROM finance_account_mappings fam
             JOIN payment_methods pm ON pm.id = fam.payment_method_id
             JOIN finance_accounts fa ON fa.id = fam.account_id
             WHERE fam.club_id = $1
             AND pm.is_active = TRUE
             AND fa.is_active = TRUE
             ORDER BY pm.is_system DESC, pm.label ASC`,
            [clubId]
        );

        return NextResponse.json({ mappings: result.rows });
    } catch (error) {
        console.error('Error fetching mappings:', error);
        return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/settings/finance/mappings
export async function POST(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const body = await request.json();
        const { mappings } = body;

        if (!mappings || !Array.isArray(mappings)) {
            return NextResponse.json(
                { error: 'Mappings array is required' },
                { status: 400 }
            );
        }

        let updatedCount = 0;

        // Update each mapping
        for (const mapping of mappings) {
            const { payment_method_id, account_id } = mapping;

            if (!payment_method_id || !account_id) {
                continue;
            }

            // Verify account belongs to this club
            const accountCheck = await query(
                `SELECT id FROM finance_accounts WHERE id = $1 AND club_id = $2`,
                [account_id, clubId]
            );

            if (accountCheck.rows.length === 0) {
                continue; // Skip invalid account
            }

            // Upsert mapping
            await query(
                `INSERT INTO finance_account_mappings (club_id, payment_method_id, account_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (club_id, payment_method_id) 
                 DO UPDATE SET account_id = $3, updated_at = NOW()`,
                [clubId, payment_method_id, account_id]
            );

            updatedCount++;
        }

        return NextResponse.json({
            success: true,
            updated_count: updatedCount
        });
    } catch (error) {
        console.error('Error updating mappings:', error);
        return NextResponse.json({ error: 'Failed to update mappings' }, { status: 500 });
    }
}
