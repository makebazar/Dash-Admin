import { NextResponse } from 'next/server';
import { requireBotAuth } from '@/lib/bot-auth';
import { query } from '@/db';
import { z } from 'zod';

const EmployeesQuerySchema = z.object({
  clubId: z.string().optional(),
  includeDismissed: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 50),
});

const ClubAccessSchema = z.object({
  clubId: z.string().optional(),
});

// GET /api/ai-tools/employees-list
// Returns list of employees for the club
export async function GET(request: Request) {
  const { context, error } = await requireBotAuth(request);
  if (error) return error;

  if (!context!.selectedClubId) {
    return NextResponse.json({
      error: 'No club selected. Please select a club first'
    }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const validation = EmployeesQuerySchema.safeParse(rawQuery);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const { clubId, includeDismissed, limit } = validation.data;
    const targetClubId = clubId || String(context!.selectedClubId);

    // Проверяем что клуб доступен пользователю
    const hasAccess = context!.availableClubs.some(c => c.id === parseInt(targetClubId));
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this club' }, { status: 403 });
    }

    let dismissedFilter = '';
    if (!includeDismissed) {
      dismissedFilter = ' AND ce.dismissed_at IS NULL';
    }

    const employeesResult = await query(
      `
      SELECT 
        u.id,
        u.full_name,
        u.phone_number,
        ce.role,
        ce.hired_at,
        ce.is_active,
        ce.dismissed_at,
        ce.show_in_schedule
      FROM club_employees ce
      JOIN users u ON ce.user_id = u.id
      WHERE ce.club_id = $1
      ${dismissedFilter}
      ORDER BY ce.show_in_schedule DESC, u.full_name ASC
      LIMIT $2
      `,
      [targetClubId, limit]
    );

    // Получаем общее количество сотрудников
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM club_employees WHERE club_id = $1 ${dismissedFilter}`,
      [targetClubId]
    );

    return NextResponse.json({
      club_id: targetClubId,
      club_name: context!.selectedClubName,
      total_count: parseInt(countResult.rows[0]?.total || 0),
      employees: employeesResult.rows.map(emp => ({
        id: emp.id,
        name: emp.full_name,
        phone: emp.phone_number,
        role: emp.role,
        hired_at: emp.hired_at,
        is_active: emp.is_active,
        is_dismissed: !!emp.dismissed_at,
        show_in_schedule: emp.show_in_schedule
      }))
    });

  } catch (error: any) {
    console.error('Employees list tool error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}