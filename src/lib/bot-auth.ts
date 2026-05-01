import { NextResponse } from 'next/server';
import { query } from '@/db';

export interface BotContext {
  userId: string;
  fullName: string;
  selectedClubId: number | null;
  selectedClubName: string | null;
  availableClubs: { id: number; name: string }[];
}

/**
 * Middleware для авторизации AI Tools через bot
 * n8n передаёт messenger_type и messenger_user_id в заголовках
 */
export async function requireBotAuth(request: Request): Promise<{ context: BotContext | null; error: NextResponse | null }> {
  const messengerType = request.headers.get('X-Messenger-Type');
  const messengerUserId = request.headers.get('X-Messenger-User-Id');

  if (!messengerType || !messengerUserId) {
    return {
      context: null,
      error: NextResponse.json(
        { error: 'Missing bot authentication headers. Provide X-Messenger-Type and X-Messenger-User-Id' },
        { status: 401 }
      )
    };
  }

  try {
    const result = await query(
      `
      SELECT 
        bl.user_id,
        u.full_name,
        bl.selected_club_id,
        c.name as selected_club_name,
        (SELECT json_agg(json_build_object('id', id, 'name', name)) FROM clubs WHERE owner_id = bl.user_id) as owner_clubs
      FROM 
        bot_user_links bl
      JOIN 
        users u ON bl.user_id = u.id
      LEFT JOIN
        clubs c ON bl.selected_club_id = c.id
      WHERE 
        bl.messenger_type = $1 AND bl.messenger_user_id = $2
      `,
      [messengerType, messengerUserId]
    );

    if (result.rowCount === 0) {
      return {
        context: null,
        error: NextResponse.json(
          { error: 'Bot account not linked. User must first link their DashAdmin account.' },
          { status: 401 }
        )
      };
    }

    const row = result.rows[0];

    // Получаем также клубы где пользователь сотрудник
    const employeeClubsResult = await query(
      `
      SELECT c.id, c.name
      FROM clubs c
      JOIN club_employees ce ON c.id = ce.club_id
      WHERE ce.user_id = $1
      `,
      [row.user_id]
    );

    // Объединяем клубы владельца и сотрудника
    const ownerClubs = row.owner_clubs || [];
    const empClubs = employeeClubsResult.rows || [];
    
    const allClubs = [...ownerClubs, ...empClubs];
    const uniqueClubs = allClubs.filter((club, index, self) =>
      index === self.findIndex(c => c.id === club.id)
    );

    // Если нет выбранного клуба и есть только один клуб — выбираем его автоматически
    let selectedClubId = row.selected_club_id;
    let selectedClubName = row.selected_club_name;
    
    if (!selectedClubId && uniqueClubs.length === 1) {
      selectedClubId = uniqueClubs[0].id;
      selectedClubName = uniqueClubs[0].name;
      
      await query(
        'UPDATE bot_user_links SET selected_club_id = $1 WHERE user_id = $2 AND messenger_type = $3',
        [selectedClubId, row.user_id, messengerType]
      );
    }

    return {
      context: {
        userId: row.user_id,
        fullName: row.full_name,
        selectedClubId,
        selectedClubName,
        availableClubs: uniqueClubs
      },
      error: null
    };
  } catch (error) {
    console.error('Bot auth error:', error);
    return {
      context: null,
      error: NextResponse.json(
        { error: 'Internal server error during authentication' },
        { status: 500 }
      )
    };
  }
}