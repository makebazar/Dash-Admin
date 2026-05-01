import { NextResponse } from 'next/server';
import { query } from '@/db';
import { getClubApiAccess } from '@/lib/club-api-access';
import crypto from 'crypto';

// POST /api/bot/generate-link-code
// Generates a short-lived code for a user to link their messenger account.
export async function POST(request: Request) {
    try {
        // First, ensure the user is logged in by checking their session.
        const access = await getClubApiAccess(); // We can call it without clubId to just get userId
        const userId = access.userId;

        // Generate a random 6-digit code
        const linkingCode = crypto.randomInt(100000, 999999).toString();
        const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // Code is valid for 10 minutes

        // Upsert the code for the user. If they already tried to link, 
        // we just update the code and expiry.
        const result = await query(
            `
            INSERT INTO bot_user_links (user_id, messenger_type, messenger_user_id, linking_code, linking_code_expires_at) 
            VALUES ($1, 'PENDING', 'PENDING', $2, $3)
            ON CONFLICT (user_id, messenger_type) 
            DO UPDATE SET
                linking_code = EXCLUDED.linking_code,
                linking_code_expires_at = EXCLUDED.linking_code_expires_at,
                updated_at = NOW();
            `,
            [userId, linkingCode, codeExpiresAt]
        );

        return NextResponse.json({ 
            code: linkingCode,
            expires_at: codeExpiresAt.toISOString()
        });

    } catch (error: any) {
        console.error('Generate link code error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}
