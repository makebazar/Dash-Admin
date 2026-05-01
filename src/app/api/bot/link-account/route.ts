import { NextResponse } from 'next/server';
import { query } from '@/db';
import { z } from 'zod';

const LinkAccountSchema = z.object({
    code: z.string().regex(/^\d{6}$/, "Code must be a 6-digit number"),
    messenger_type: z.enum(['MAX', 'TELEGRAM', 'N8N']),
    messenger_user_id: z.string().min(1, "Messenger user ID cannot be empty"),
});

// POST /api/bot/link-account
// This is a public endpoint called by the n8n workflow to finalize the link.
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = LinkAccountSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.issues }, { status: 400 });
        }

        const { code, messenger_type, messenger_user_id } = validation.data;

        // Find the pending link request by code and check if it has expired
        const linkRequest = await query(
            `SELECT user_id, linking_code_expires_at FROM bot_user_links WHERE linking_code = $1 AND messenger_type = 'PENDING'`,
            [code]
        );

        if (linkRequest.rowCount === 0) {
            return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
        }

        const { user_id, linking_code_expires_at } = linkRequest.rows[0];

        if (new Date() > new Date(linking_code_expires_at)) {
            return NextResponse.json({ error: 'Expired code' }, { status: 400 });
        }

        // The code is valid. Finalize the link.
        // We delete the old pending record and create a new, final one.
        // This handles cases where a user might link, unlink, and relink.
        await query('BEGIN');
        
        // Delete any previous links for this messenger user to avoid unique constraint errors
        await query('DELETE FROM bot_user_links WHERE messenger_type = $1 AND messenger_user_id = $2', [messenger_type, messenger_user_id]);

        // Delete the pending record
        await query('DELETE FROM bot_user_links WHERE user_id = $1 AND messenger_type = \'PENDING\'', [user_id]);
        
        // Create the final, active link
        await query(
            `
            INSERT INTO bot_user_links (user_id, messenger_type, messenger_user_id) 
            VALUES ($1, $2, $3)
            `,
            [user_id, messenger_type, messenger_user_id]
        );
        
        await query('COMMIT');

        return NextResponse.json({ success: true, message: 'Account linked successfully' });

    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Link account error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
