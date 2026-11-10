import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";
import { notifyDashLockProductsUpdated } from "@/lib/notify-dashlock";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string; movementId: string }> },
) {
  const client = await getClient();
  try {
    const { clubId, movementId } = await params;
    await requireModuleAccess(clubId, "finance", "edit");

    // returnStock can be passed via body or query param (default: true)
    let returnStock = true;
    try {
      const body = await request.json();
      if (typeof body?.returnStock === "boolean") {
        returnStock = body.returnStock;
      }
    } catch {
      // body may not be JSON
    }

    const url = new URL(request.url);
    if (url.searchParams.has("returnStock")) {
      returnStock = url.searchParams.get("returnStock") === "true";
    }

    await client.query("BEGIN");

    // 1. Try finding by shift_receipts.id first
    let receipt: any = null;
    let items: any[] = [];
    let movements: any[] = [];

    const receiptRes = await client.query(
      `SELECT * FROM shift_receipts WHERE id = $1 AND club_id = $2`,
      [movementId, clubId],
    );

    if (receiptRes.rowCount && receiptRes.rowCount > 0) {
      receipt = receiptRes.rows[0];

      const itemsRes = await client.query(
        `SELECT i.*, p.name as product_name, COALESCE(i.selling_price_snapshot, p.selling_price) as effective_price
         FROM shift_receipt_items i
         JOIN warehouse_products p ON i.product_id = p.id
         WHERE i.receipt_id = $1`,
        [receipt.id],
      );
      items = itemsRes.rows;

      const movRes = await client.query(
        `SELECT m.* FROM warehouse_stock_movements m
         WHERE m.club_id = $2 
           AND (
             (m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = $1)
             OR m.reason LIKE '%Чек #' || $1 || '%'
           )`,
        [receipt.id, clubId],
      );
      movements = movRes.rows;
    } else {
      // 2. Try finding by warehouse_stock_movements.id
      const movRes = await client.query(
        `SELECT m.*, COALESCE(m.price_at_time, p.selling_price) as effective_price, p.name as product_name
         FROM warehouse_stock_movements m
         JOIN warehouse_products p ON m.product_id = p.id
         WHERE m.id = $1 AND m.club_id = $2`,
        [movementId, clubId],
      );

      if (movRes.rowCount && movRes.rowCount > 0) {
        const mov = movRes.rows[0];
        movements = [mov];
        items = [
          {
            product_id: mov.product_id,
            quantity: Math.abs(mov.change_amount),
            effective_price: mov.effective_price,
            product_name: mov.product_name,
          },
        ];

        if (mov.related_entity_type === "SHIFT_RECEIPT" && mov.related_entity_id) {
          const rRes = await client.query(
            `SELECT * FROM shift_receipts WHERE id = $1 AND club_id = $2`,
            [mov.related_entity_id, clubId],
          );
          if (rRes.rowCount && rRes.rowCount > 0) {
            receipt = rRes.rows[0];
          }
        }
      }
    }

    if (!receipt && movements.length === 0) {
      throw new Error("Транзакция или чек не найдены");
    }

    // Determine warehouse for stock operations
    let warehouseId = receipt?.warehouse_id || movements[0]?.warehouse_id;
    if (!warehouseId) {
      const whRes = await client.query(
        `SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1`,
        [clubId],
      );
      warehouseId = whRes.rows[0]?.id;
    }

    // Total amount to deduct from shift / salary
    const totalAmount = receipt
      ? Number(receipt.total_amount || 0)
      : items.reduce(
          (sum, it) =>
            sum +
            Number(it.effective_price || 0) * Number(it.quantity || 1),
          0,
        );

    // 2. Return stock to warehouse if requested
    if (returnStock && warehouseId) {
      for (const item of items) {
        const qty = Math.abs(Number(item.quantity) || 1);
        await client.query(
          `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (warehouse_id, product_id) DO UPDATE
           SET quantity = warehouse_stock.quantity + $3`,
          [warehouseId, item.product_id, qty],
        );

        await client.query(
          `UPDATE warehouse_products
           SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
           WHERE id = $1`,
          [item.product_id],
        );
      }

      // Delete stock movement records
      if (receipt) {
        await client.query(
          `DELETE FROM warehouse_stock_movements
           WHERE club_id = $2
             AND (
               (related_entity_type = 'SHIFT_RECEIPT' AND related_entity_id = $1)
               OR reason LIKE '%Чек #' || $1 || '%'
             )`,
          [receipt.id, clubId],
        );
      } else if (movements.length > 0) {
        await client.query(
          `DELETE FROM warehouse_stock_movements WHERE id = $1`,
          [movements[0].id],
        );
      }
    } else if (!returnStock && movements.length > 0) {
      // Stock is not returned, update movement reason to note debt was waived without stock return
      if (receipt) {
        await client.query(
          `UPDATE warehouse_stock_movements
           SET reason = reason || ' [Списано без возврата товара]'
           WHERE club_id = $2
             AND (
               (related_entity_type = 'SHIFT_RECEIPT' AND related_entity_id = $1)
               OR reason LIKE '%Чек #' || $1 || '%'
             )`,
          [receipt.id, clubId],
        );
      } else {
        await client.query(
          `UPDATE warehouse_stock_movements
           SET reason = reason || ' [Списано без возврата товара]'
           WHERE id = $1`,
          [movements[0].id],
        );
      }
    }

    // 3. Void receipt in shift_receipts
    if (receipt) {
      const voidNote = returnStock
        ? "[Покупка отменена: сумма списана из ЗП, товар возвращен на склад]"
        : "[Покупка отменена: сумма списана из ЗП, товар НЕ возвращался на склад]";
      await client.query(
        `UPDATE shift_receipts
         SET voided_at = CURRENT_TIMESTAMP,
             notes = COALESCE(notes || E'\\n', '') || $2
         WHERE id = $1`,
        [receipt.id, voidNote],
      );
    }

    // 4. Update shift bar_purchases
    const targetShiftIds = new Set<string>();
    if (receipt?.salary_target_shift_id) {
      targetShiftIds.add(String(receipt.salary_target_shift_id));
    }
    if (receipt?.shift_id) {
      targetShiftIds.add(String(receipt.shift_id));
    }
    for (const mov of movements) {
      if (mov.shift_id) targetShiftIds.add(String(mov.shift_id));
    }

    for (const sId of targetShiftIds) {
      await client.query(
        `UPDATE shifts
         SET bar_purchases = GREATEST(0, COALESCE(bar_purchases, 0) - $1)
         WHERE id = $2`,
        [totalAmount, sId],
      );
    }

    await client.query("COMMIT");

    if (returnStock) {
      notifyDashLockProductsUpdated(Number(clubId));
    }

    return NextResponse.json({
      success: true,
      returnStock,
      totalAmount,
      receiptId: receipt?.id,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    const status = error?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Delete bar purchase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
