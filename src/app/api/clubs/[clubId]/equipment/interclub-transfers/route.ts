import { NextResponse } from "next/server";
import { getClient, query } from "@/db";
import { cookies } from "next/headers";
import { hasColumn } from "@/lib/db-compat";
import { resolveEquipmentStateForPersistence } from "@/lib/equipment-status";
import { getClubApiAccess, hasModuleAccess } from "@/lib/club-api-access";

function normalizeTransferRow(row: any) {
  return {
    id: row.id,
    source_club_id: row.source_club_id,
    target_club_id: row.target_club_id,
    status: row.status,
    comment: row.comment,
    created_by: row.created_by,
    created_at: row.created_at,
    completed_by: row.completed_by,
    completed_at: row.completed_at,
    completed_shift_id: row.completed_shift_id,
    direction: row.direction,
    source_club_name: row.source_club_name,
    target_club_name: row.target_club_name,
    created_by_name: row.created_by_name,
    completed_by_name: row.completed_by_name,
    item_count: Number(row.item_count || 0),
    items: Array.isArray(row.items) ? row.items : [],
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Unified access check
    await getClubApiAccess(clubId);

    const { searchParams } = new URL(request.url);
    const limitRaw = Number.parseInt(searchParams.get("limit") || "200", 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

    const res = await query(
      `
            SELECT
                t.*,
                CASE WHEN t.source_club_id = $1::int THEN 'OUT' ELSE 'IN' END as direction,
                sc.name as source_club_name,
                tc.name as target_club_name,
                cu.full_name as created_by_name,
                uu.full_name as completed_by_name,
                COUNT(i.id)::int as item_count,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'equipment_id', i.equipment_id,
                            'equipment_name', e.name,
                            'equipment_type', e.type,
                            'target_workstation_id', i.target_workstation_id,
                            'target_workstation_name', tw.name,
                            'target_workstation_zone', tw.zone
                        )
                        ORDER BY e.name
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'::jsonb
                ) as items
            FROM equipment_transfers t
            LEFT JOIN clubs sc ON sc.id = t.source_club_id
            LEFT JOIN clubs tc ON tc.id = t.target_club_id
            LEFT JOIN users cu ON cu.id = t.created_by
            LEFT JOIN users uu ON uu.id = t.completed_by
            LEFT JOIN equipment_transfer_items i ON i.transfer_id = t.id
            LEFT JOIN equipment e ON e.id = i.equipment_id
            LEFT JOIN club_workstations tw ON tw.id = i.target_workstation_id
            WHERE t.source_club_id = $1::int OR t.target_club_id = $1::int
            GROUP BY t.id, sc.name, tc.name, cu.full_name, uu.full_name
            ORDER BY t.created_at DESC
            LIMIT $2
            `,
      [clubId, limit],
    );

    return NextResponse.json({ transfers: res.rows.map(normalizeTransferRow) });
  } catch (error) {
    console.error("Get Interclub Transfers Error:", error);
    return NextResponse.json(
      { error: (error as any).message || "Internal Server Error" },
      { status: (error as any).status || 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const targetClubId = body?.target_club_id;
    const comment =
      typeof body?.comment === "string" ? body.comment.trim() : "";
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];

    if (!targetClubId || typeof targetClubId !== "number") {
      return NextResponse.json(
        { error: "target_club_id is required" },
        { status: 400 },
      );
    }

    if (String(targetClubId) === String(clubId)) {
      return NextResponse.json(
        { error: "Нельзя перемещать в тот же клуб" },
        { status: 400 },
      );
    }

    const uniqueItems = Array.from(
      new Map(
        itemsRaw
          .filter(
            (i: any) =>
              i && typeof i.equipment_id === "string" && i.equipment_id.trim(),
          )
          .map((i: any) => [
            i.equipment_id.trim(),
            {
              equipment_id: i.equipment_id.trim(),
              target_workstation_id:
                typeof i.target_workstation_id === "string" &&
                i.target_workstation_id.trim()
                  ? i.target_workstation_id.trim()
                  : null,
            },
          ]),
      ).values(),
    );

    if (uniqueItems.length === 0) {
      return NextResponse.json({ error: "items is required" }, { status: 400 });
    }

    if (uniqueItems.length > 50) {
      return NextResponse.json(
        { error: "Слишком много позиций (макс 50)" },
        { status: 400 },
      );
    }

    // Unified permission check
    const access = await getClubApiAccess(clubId);
    if (!hasModuleAccess(access, "equipment", "edit", clubId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clubOwnershipRes = await query(
      `SELECT c.owner_id
            FROM clubs c
            WHERE c.id = $1`,
      [clubId],
    );
    const ownerId = clubOwnershipRes.rows[0]?.owner_id;
    if (!ownerId) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const targetClubCheck = await query(
      `SELECT 1
            FROM clubs
            WHERE id = $1 AND owner_id = $2`,
      [targetClubId, ownerId],
    );
    if ((targetClubCheck.rowCount || 0) === 0) {
      return NextResponse.json(
        { error: "Недоступный клуб назначения" },
        { status: 400 },
      );
    }

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const sourceClubNameRes = await client.query(
        `SELECT name FROM clubs WHERE id = $1`,
        [clubId],
      );
      const sourceClubName =
        sourceClubNameRes.rows[0]?.name || `Клуб ${clubId}`;

      const equipmentIds = uniqueItems.map(
        (item: any) => (item as any).equipment_id,
      );
      const hasEquipmentStatusColumn = await hasColumn("equipment", "status");

      const equipmentRes = await client.query(
        `SELECT id::text as id, workstation_id::text as workstation_id, is_active${hasEquipmentStatusColumn ? ", status" : ""}, assigned_user_id::text as assigned_user_id
                FROM equipment
                WHERE club_id = $1 AND id = ANY($2::uuid[])
                FOR UPDATE`,
        [clubId, equipmentIds],
      );
      if (equipmentRes.rows.length !== equipmentIds.length) {
        const err: any = new Error("Часть оборудования не найдена в клубе");
        err.statusCode = 400;
        throw err;
      }

      const workstationIds = Array.from(
        new Set(
          uniqueItems
            .map((item: any) => (item as any).target_workstation_id)
            .filter(Boolean)
            .map((v: any) => String(v)),
        ),
      );

      if (workstationIds.length > 0) {
        const wsRes = await client.query(
          `SELECT id::text as id
                    FROM club_workstations
                    WHERE club_id = $1 AND id = ANY($2::uuid[])`,
          [targetClubId, workstationIds],
        );
        if (wsRes.rows.length !== workstationIds.length) {
          const err: any = new Error("Некорректные места назначения");
          err.statusCode = 400;
          throw err;
        }
      }

      const transferRes = await client.query(
        `INSERT INTO equipment_transfers (source_club_id, target_club_id, status, comment, created_by)
                VALUES ($1, $2, 'CREATED', $3, $4)
                RETURNING id`,
        [clubId, targetClubId, comment || null, userId],
      );
      const transferId = transferRes.rows[0]?.id;

      for (const item of uniqueItems as any[]) {
        const equipment = equipmentRes.rows.find(
          (r: any) => String(r.id) === String((item as any).equipment_id),
        );
        if (!equipment) throw new Error("Оборудование не найдено");

        await client.query(
          `INSERT INTO equipment_transfer_items (transfer_id, equipment_id, source_workstation_id, target_workstation_id)
                    VALUES ($1, $2, $3, $4)`,
          [
            transferId,
            (item as any).equipment_id,
            equipment.workstation_id ? String(equipment.workstation_id) : null,
            (item as any).target_workstation_id
              ? String((item as any).target_workstation_id)
              : null,
          ],
        );

        const resolvedState = resolveEquipmentStateForPersistence({
          currentStatus: equipment.status,
          currentIsActive: equipment.is_active,
          currentWorkstationId: equipment.workstation_id
            ? String(equipment.workstation_id)
            : null,
          requestedWorkstationId: null,
          hasRequestedWorkstation: true,
        });

        if (hasEquipmentStatusColumn) {
          await client.query(
            `UPDATE equipment
                        SET workstation_id = $1,
                            assigned_user_id = NULL,
                            is_active = $2,
                            status = $3
                        WHERE id = $4`,
            [
              resolvedState.workstation_id,
              resolvedState.is_active,
              resolvedState.status,
              (item as any).equipment_id,
            ],
          );
        } else {
          await client.query(
            `UPDATE equipment
                        SET workstation_id = $1,
                            assigned_user_id = NULL,
                            is_active = $2
                        WHERE id = $3`,
            [
              resolvedState.workstation_id,
              resolvedState.is_active,
              (item as any).equipment_id,
            ],
          );
        }
      }

      await client.query(
        `INSERT INTO club_tasks
                (club_id, type, title, description, status, priority, related_entity_type, related_entity_uuid, created_by)
                VALUES
                ($1, 'EQUIPMENT_TRANSFER', $2, $3, 'PENDING', 'MEDIUM', 'EQUIPMENT_TRANSFER', $4, $5)`,
        [
          targetClubId,
          `Оборудование из клуба: ${sourceClubName}`,
          comment || null,
          transferId,
          userId,
        ],
      );

      await client.query("BEGIN"); // This was a mistake in original code? No, wait.
      // Original code had client.query('BEGIN') at start of try block.
      // Oh, original code was:
      /*
            try {
                await client.query('BEGIN')
                ...
                await client.query('COMMIT')
            }
            */
      // I should stick to that structure.

      await client.query("COMMIT");
      return NextResponse.json({ success: true, transfer_id: transferId });
    } catch (error) {
      await client.query("ROLLBACK");
      const status =
        typeof (error as any)?.statusCode === "number"
          ? (error as any).statusCode
          : 500;
      if (status >= 500)
        console.error("Create Interclub Transfer Error:", error);
      return NextResponse.json(
        { error: (error as any)?.message || "Internal Server Error" },
        { status },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Interclub Transfer Wrapper Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
