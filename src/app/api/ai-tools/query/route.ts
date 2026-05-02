import { NextResponse } from 'next/server';
import { requireBotAuth } from '@/lib/bot-auth';
import { query } from '@/db';
import { z } from 'zod';

// Preprocess arrays in input before validation (fix for n8n sending arrays)
const preprocessArrays = (schema: z.ZodTypeAny) => {
  return z.preprocess((arg) => {
    if (arg === undefined || arg === null) return arg;
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      const obj = { ...arg as Record<string, unknown> };
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
          obj[key] = (obj[key] as unknown[])[0];
        }
      }
      return obj;
    }
    return arg;
  }, schema);
};

const toolEnum = ['getRevenue', 'getShiftsSummary', 'getEmployees', 'getEmployeeHours', 'selectClub', 'parseCallback'] as const;
const periodEnum = ['today', 'yesterday', 'last7days', 'last30days', 'this_month'] as const;

const QueryInput = z.object({
  tool: z.enum(toolEnum),
  clubId: z.union([z.coerce.number(), z.number()]).optional(),
  employeeId: z.string().optional(),
  period: z.enum(periodEnum).optional(),
  data: z.string().optional(),
});

const QuerySchema = preprocessArrays(QueryInput);

function getDateRange(period?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { start: today.toISOString().slice(0, 10), end: today.toISOString().slice(0, 10) };
    case 'last7days':
      return { start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end: today.toISOString().slice(0, 10) };
    case 'last30days':
      return { start: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end: today.toISOString().slice(0, 10) };
    case 'this_month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: today.toISOString().slice(0, 10) };
    case 'yesterday':
    default:
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return { start: yesterday.toISOString().slice(0, 10), end: yesterday.toISOString().slice(0, 10) };
  }
}

export async function POST(request: Request) {
  const { context, error } = await requireBotAuth(request);
  if (error) return error;

  try {
    let body = await request.json();
    
    // Debug logging (remove in production)
    console.log('[AI-Tools Query] Raw body:', JSON.stringify(body));
    
    // Fix: if body itself is an array with one element, unwrap it
    if (Array.isArray(body) && body.length === 1) {
      body = body[0];
    }
    
    // Fix: handle case where body has wrapped values
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const fixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (Array.isArray(value) && value.length === 1) {
          fixed[key] = value[0];
        } else {
          fixed[key] = value;
        }
      }
      body = fixed;
    }
    
    const validation = QuerySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request', details: validation.error.issues }, { status: 400 });
    }

    const { tool, clubId, employeeId, period, data } = validation.data as { tool: string; clubId?: number; employeeId?: string; period?: string; data?: string };
    const { start, end } = getDateRange(period);

    switch (tool) {
      case 'getRevenue': {
        const club = clubId || context!.selectedClubId;
        if (!club) return NextResponse.json({ output: 'Пожалуйста, выберите клуб для просмотра выручки.' });

        const result = await query(
          `SELECT COALESCE(SUM(cash_income + card_income), 0)::numeric as total,
                  COUNT(id)::int as count
           FROM shifts WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3`,
          [club, start, end]
        );
        const row = result.rows[0];
        return NextResponse.json({
          output: `📊 Выручка за ${period || 'вчера'}: ${parseFloat(row.total).toLocaleString('ru-RU')} ₽\nСмен: ${row.count}`
        });
      }

      case 'getShiftsSummary': {
        const club = clubId || context!.selectedClubId;
        if (!club) return NextResponse.json({ output: 'Пожалуйста, выберите клуб для просмотра смен.' });

        const result = await query(
          `SELECT COUNT(id)::int as total, COALESCE(SUM(total_hours), 0)::numeric as hours
           FROM shifts WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3`,
          [club, start, end]
        );
        const row = result.rows[0];
        return NextResponse.json({
          output: `📅 Смены за ${period || 'вчера'}: ${row.total}\nВсего часов: ${parseFloat(row.hours).toFixed(1)}`
        });
      }

      case 'getEmployees': {
        const club = clubId || context!.selectedClubId;
        if (!club) return NextResponse.json({ output: 'Пожалуйста, выберите клуб для списка сотрудников.' });

        const result = await query(
          `SELECT u.full_name, e.position
           FROM club_employees e JOIN users u ON e.user_id = u.id
           WHERE e.club_id = $1 LIMIT 10`,
          [club]
        );
        if (result.rows.length === 0) return NextResponse.json({ output: 'Сотрудники не найдены.' });
        const list = result.rows.map((r, i) => `${i + 1}. ${r.full_name} (${r.position || 'без должности'})`).join('\n');
        return NextResponse.json({ output: `👥 Сотрудники:\n${list}` });
      }

      case 'getEmployeeHours': {
        if (!employeeId) return NextResponse.json({ output: 'Укажите ID сотрудника.' });
        const result = await query(
          `SELECT COALESCE(SUM(total_hours), 0)::numeric as hours, COUNT(id)::int as shifts
           FROM shifts WHERE user_id = $1 AND check_in::date BETWEEN $2 AND $3`,
          [employeeId, start, end]
        );
        const row = result.rows[0];
        return NextResponse.json({
          output: `⏱️ Часы за ${period || 'неделю'}: ${parseFloat(row.hours).toFixed(1)}ч\nСмен: ${row.shifts}`
        });
      }

      case 'selectClub': {
        if (!clubId) return NextResponse.json({ output: 'Укажите ID клуба.' });
        await query(
          'UPDATE bot_user_links SET selected_club_id = $1 WHERE user_id = $2 AND messenger_type = $3',
          [clubId, context!.userId, 'N8N']
        );
        const clubResult = await query('SELECT name FROM clubs WHERE id = $1', [clubId]);
        const name = clubResult.rows[0]?.name || 'клуб';
        return NextResponse.json({ output: `✅ Выбран клуб: ${name}` });
      }

      case 'parseCallback': {
        if (data?.startsWith('selectClub:')) {
          const newClubId = parseInt(data.split(':')[1]);
          await query(
            'UPDATE bot_user_links SET selected_club_id = $1 WHERE user_id = $2 AND messenger_type = $3',
            [newClubId, context!.userId, 'N8N']
          );
          const clubResult = await query('SELECT name FROM clubs WHERE id = $1', [newClubId]);
          return NextResponse.json({ output: `✅ Клуб выбран: ${clubResult.rows[0]?.name || ''}` });
        }
        return NextResponse.json({ output: 'Неизвестная команда.' });
      }

      default:
        return NextResponse.json({ output: 'Неизвестная команда.' });
    }
  } catch (err: any) {
    console.error('Query error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}