import { NextResponse } from 'next/server';
import { requireBotAuth } from '@/lib/bot-auth';
import { query } from '@/db';
import { z } from 'zod';

const SelectClubSchema = z.object({
  clubId: z.string(),
});

// GET /api/ai-tools/select-club
// Returns available clubs for selection
export async function GET(request: Request) {
  const { context, error } = await requireBotAuth(request);
  if (error) return error;

  return NextResponse.json({
    selected_club: context!.selectedClubId ? {
      id: context!.selectedClubId,
      name: context!.selectedClubName
    } : null,
    available_clubs: context!.availableClubs
  });
}

// POST /api/ai-tools/select-club
// Sets the selected club for the bot user
export async function POST(request: Request) {
  const { context, error } = await requireBotAuth(request);
  if (error) return error;

  try {
    const body = await request.json();
    const validation = SelectClubSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const { clubId } = validation.data;
    const clubIdNum = parseInt(clubId);

    // Проверяем что клуб доступен пользователю
    const hasAccess = context!.availableClubs.some(c => c.id === clubIdNum);
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. This club is not available to you.' 
      }, { status: 403 });
    }

    // Обновляем выбранный клуб
    const messengerType = request.headers.get('X-Messenger-Type');
    
    await query(
      'UPDATE bot_user_links SET selected_club_id = $1 WHERE user_id = $2 AND messenger_type = $3',
      [clubIdNum, context!.userId, messengerType]
    );

    const clubName = context!.availableClubs.find(c => c.id === clubIdNum)?.name;

    return NextResponse.json({
      success: true,
      selected_club: {
        id: clubIdNum,
        name: clubName
      }
    });

  } catch (error: any) {
    console.error('Select club error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}