import { NextResponse } from 'next/server';
import { query } from '@/db';
import { z } from 'zod';

const GetContextSchema = z.object({
    messenger_type: z.enum(['MAX', 'TELEGRAM', 'N8N']),
    messenger_user_id: z.string().min(1, "Messenger user ID cannot be empty"),
});

// GET /api/bot/context?messenger_type=...&messenger_user_id=...
// This endpoint is called by n8n to check if a user is already linked
// and to retrieve their context (e.g., user_id, selected club).
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const validation = GetContextSchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input', details: validation.error.errors }, { status: 400 });
    }

    const { messenger_type, messenger_user_id } = validation.data;

    try {
        const result = await query(
            `
            SELECT 
                bl.user_id,
                u.full_name,
                bl.selected_club_id,
                c.name as selected_club_name,
                (SELECT json_agg(json_build_object('id', cl.id, 'name', cl.name))
                 FROM clubs cl
                 JOIN user_clubs uc ON cl.id = uc.club_id
                 WHERE uc.user_id = bl.user_id) as available_clubs
            FROM 
                bot_user_links bl
            JOIN 
                users u ON bl.user_id = u.id
            LEFT JOIN
                clubs c ON bl.selected_club_id = c.id
            WHERE 
                bl.messenger_type = $1 AND bl.messenger_user_id = $2
            `,
            [messenger_type, messenger_user_id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'User not found or not linked' }, { status: 404 });
        }
        
        // We also need to fetch the clubs where the user is an employee
        const employeeClubsResult = await query(
            `
            SELECT 
                c.id,
                c.name
            FROM 
                clubs c
            JOIN 
                employees e ON c.id = e.club_id
            WHERE 
                e.user_id = $1
            `,
            [result.rows[0].user_id]
        );

        const response = {
            user: {
                id: result.rows[0].user_id,
                full_name: result.rows[0].full_name,
            },
            selected_club: result.rows[0].selected_club_id ? {
                id: result.rows[0].selected_club_id,
                name: result.rows[0].selected_club_name,
            } : null,
            available_clubs: result.rows[0].available_clubs || [],
            employee_clubs: employeeClubsResult.rows || []
        };
        
        // If there's only one available club (owned or employee), set it as selected
        const all_clubs = [...response.available_clubs, ...response.employee_clubs];
        const unique_clubs = all_clubs.filter((club, index, self) =>
            index === self.findIndex((c) => (
                c.id === club.id
            ))
        );

        if (unique_clubs.length === 1 && !response.selected_club) {
             await query(
                'UPDATE bot_user_links SET selected_club_id = $1 WHERE user_id = $2 AND messenger_type = $3',
                [unique_clubs[0].id, response.user.id, messenger_type]
            );
            response.selected_club = unique_clubs[0];
        }


        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Get context error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
