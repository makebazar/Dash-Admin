import { NextResponse } from 'next/server';
import { query } from '@/db';
import { z } from 'zod';

const DirectLinkSchema = z.object({
    user_id: z.string().uuid(),
    messenger_type: z.enum(['MAX', 'TELEGRAM', 'N8N']),
    messenger_user_id: z.string().min(1),
    club_id: z.number().optional(),
});

// POST /api/bot/direct-link
// Direct link for testing without code flow
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = DirectLinkSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.issues }, { status: 400 });
        }

        const { user_id, messenger_type, messenger_user_id, club_id } = validation.data;

        // Delete any existing link for this messenger user
        await query(
            'DELETE FROM bot_user_links WHERE messenger_type = $1 AND messenger_user_id = $2',
            [messenger_type, messenger_user_id]
        );

        // Create the direct link
        const result = await query(
            `INSERT INTO bot_user_links (user_id, messenger_type, messenger_user_id, current_club_id) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, user_id, messenger_type, messenger_user_id, current_club_id`,
            [user_id, messenger_type, messenger_user_id, club_id]
        );

        return NextResponse.json({ 
            success: true, 
            link: result.rows[0],
            message: 'Account linked directly' 
        });

    } catch (error: any) {
        console.error('Direct link error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}