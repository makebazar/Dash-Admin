import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/db"
import { isSuperAdmin } from "@/lib/super-admin"
import {
  ensureSupportTables,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support"

export const dynamic = "force-dynamic"

async function getViewer() {
  const userId = (await cookies()).get("session_user_id")?.value
  if (!userId) return null

  const result = await query(
    `SELECT id, full_name, phone_number, is_super_admin
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  )

  if ((result.rowCount || 0) === 0) {
    return null
  }

  const user = result.rows[0]

  return {
    id: user.id as string,
    full_name: user.full_name as string,
    phone_number: user.phone_number as string | null,
    can_manage_all: isSuperAdmin(user.is_super_admin, user.id, user.phone_number),
  }
}

export async function GET(request: Request) {
  try {
    await ensureSupportTables()
    const viewer = await getViewer()
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope")

    const values: Array<string> = []
    let whereClause = "WHERE 1 = 0"

    if (viewer?.can_manage_all && scope === "all") {
      whereClause = ""
    } else if (viewer) {
      whereClause = "WHERE t.user_id = $1"
      values.push(viewer.id)
    }

    const ticketsResult = await query(
      `
      SELECT
        t.id,
        t.user_id,
        t.guest_name,
        t.guest_email,
        t.guest_phone,
        t.source,
        t.subject,
        t.category,
        t.priority,
        t.status,
        t.description,
        t.assigned_to,
        t.closed_at,
        t.last_message_at,
        t.created_at,
        t.updated_at,
        COALESCE(u.full_name, t.guest_name, 'Гость') AS submitter_name,
        COALESCE(u.phone_number, t.guest_phone) AS submitter_phone,
        t.guest_email AS submitter_email,
        staff.full_name AS assigned_to_name,
        COUNT(m.id)::int AS message_count
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN users staff ON staff.id = t.assigned_to
      LEFT JOIN support_messages m ON m.ticket_id = t.id
      ${whereClause}
      GROUP BY t.id, u.full_name, u.phone_number, staff.full_name
      ORDER BY t.last_message_at DESC, t.created_at DESC
      `,
      values
    )

    return NextResponse.json({
      viewer: viewer || null,
      tickets: ticketsResult.rows,
      enums: {
        categories: SUPPORT_CATEGORIES,
        priorities: SUPPORT_PRIORITIES,
        statuses: SUPPORT_STATUSES,
      },
    })
  } catch (error) {
    console.error("Get Support Tickets Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureSupportTables()
    const viewer = await getViewer()

    const body = await request.json()
    const subject = String(body?.subject || "").trim()
    const description = String(body?.description || "").trim()
    const category = String(body?.category || "GENERAL").trim().toUpperCase() as SupportCategory
    const priority = String(body?.priority || "MEDIUM").trim().toUpperCase() as SupportPriority
    const guestName = String(body?.guest_name || "").trim()
    const guestEmail = String(body?.guest_email || "").trim()
    const guestPhone = String(body?.guest_phone || "").trim()
    const source = String(body?.source || "web").trim().toLowerCase()

    if (!subject || subject.length < 4) {
      return NextResponse.json({ error: "Укажите тему обращения минимум из 4 символов" }, { status: 400 })
    }

    if (!description || description.length < 10) {
      return NextResponse.json({ error: "Опишите проблему минимум в 10 символах" }, { status: 400 })
    }

    if (!SUPPORT_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Некорректная категория" }, { status: 400 })
    }

    if (!SUPPORT_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: "Некорректный приоритет" }, { status: 400 })
    }

    if (!viewer) {
      if (!guestName || guestName.length < 2) {
        return NextResponse.json({ error: "Укажите имя для обратной связи" }, { status: 400 })
      }

      if (!guestEmail && !guestPhone) {
        return NextResponse.json({ error: "Укажите email или телефон для обратной связи" }, { status: 400 })
      }
    }

    const ticketResult = await query(
      `
      INSERT INTO support_tickets (
        user_id,
        guest_name,
        guest_email,
        guest_phone,
        source,
        subject,
        category,
        priority,
        status,
        description,
        last_message_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9, NOW(), NOW())
      RETURNING id
      `,
      [
        viewer?.id || null,
        viewer ? viewer.full_name : guestName || null,
        viewer ? null : guestEmail || null,
        viewer ? viewer.phone_number || null : guestPhone || null,
        source,
        subject,
        category,
        priority,
        description,
      ]
    )

    const ticketId = ticketResult.rows[0]?.id

    await query(
      `
      INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_email, sender_phone, message, is_staff)
      VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      `,
      [
        ticketId,
        viewer?.id || null,
        viewer ? viewer.full_name : guestName,
        viewer ? null : guestEmail || null,
        viewer ? viewer.phone_number || null : guestPhone || null,
        description,
      ]
    )

    return NextResponse.json({ success: true, ticket_id: ticketId, guest_mode: !viewer })
  } catch (error) {
    console.error("Create Support Ticket Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSupportTables()
    const viewer = await getViewer()

    if (!viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!viewer.can_manage_all) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const ticketId = Number(body?.ticket_id)
    const status = String(body?.status || "").trim().toUpperCase() as SupportStatus

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return NextResponse.json({ error: "Некорректный тикет" }, { status: 400 })
    }

    if (!SUPPORT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Некорректный статус" }, { status: 400 })
    }

    const result = await query(
      `
      UPDATE support_tickets
      SET
        status = $1::varchar,
        assigned_to = CASE WHEN $1::varchar IN ('IN_PROGRESS', 'ANSWERED', 'CLOSED') THEN $2 ELSE assigned_to END,
        closed_at = CASE WHEN $1::varchar = 'CLOSED' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id
      `,
      [status, viewer.id, ticketId]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update Support Ticket Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
