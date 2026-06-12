import type { InventorySettings as NormalizedInventorySettings } from "@/lib/inventory-settings";
import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { query, getClient } from "@/db";
import type { PriceTagSettings, PriceTagTemplate } from "./types";
import { requireClubAccess, requireSessionUserId } from "./auth";

export async function calculateAnalytics(clubId: string) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    await client.query(
      `
            UPDATE warehouse_products p
            SET sales_velocity = COALESCE((
                WITH FirstSale AS (
                    SELECT product_id, MIN(created_at) as first_sale_date
                    FROM warehouse_stock_movements
                    WHERE type = 'SALE'
                      AND COALESCE(related_entity_type, '') != 'SHIFT_RECEIPT_VOID'
                    GROUP BY product_id
                ),
                NetSales AS (
                    SELECT
                        m.product_id,
                        SUM(
                            CASE
                                WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID' THEN -ABS(m.change_amount)
                                WHEN m.type = 'RETURN' THEN -ABS(m.change_amount)
                                WHEN m.type = 'SALE' THEN ABS(m.change_amount)
                                ELSE 0
                            END
                        )::numeric as net_units
                    FROM warehouse_stock_movements m
                    LEFT JOIN shift_receipts sr ON m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = sr.id
                    WHERE m.created_at > NOW() - INTERVAL '30 days'
                      AND m.type IN ('SALE', 'RETURN')
                      AND COALESCE(sr.counts_in_revenue, true) = true
                    GROUP BY m.product_id
                )
                SELECT
                    GREATEST(0, ns.net_units) /
                    GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (NOW() - fs.first_sale_date)) / 86400.0)))
                FROM FirstSale fs
                JOIN NetSales ns ON ns.product_id = fs.product_id
                WHERE fs.product_id = p.id
                GROUP BY fs.first_sale_date, ns.net_units
            ), 0)
            WHERE club_id = $1
        `,
      [clubId],
    );

    const revenueData = await client.query(
      `
            WITH ProductRevenue AS (
                SELECT
                    p.id as product_id,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'RETURN'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'SALE'
                                THEN ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            ELSE 0
                        END
                    ), 0) as total_revenue
                FROM warehouse_products p
                LEFT JOIN warehouse_stock_movements m ON p.id = m.product_id
                    AND m.type IN ('SALE', 'RETURN')
                    AND m.created_at > NOW() - INTERVAL '30 days'
                LEFT JOIN shift_receipts sr ON m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = sr.id
                WHERE p.club_id = $1 AND p.is_active = true
                  AND COALESCE(sr.counts_in_revenue, true) = true
                GROUP BY p.id
            ),
            TotalStats AS (
                SELECT SUM(total_revenue) as grand_total FROM ProductRevenue
            ),
            RankedProducts AS (
                SELECT
                    product_id,
                    total_revenue,
                    SUM(total_revenue) OVER (ORDER BY total_revenue DESC) as running_total,
                    (SELECT grand_total FROM TotalStats) as grand_total
                FROM ProductRevenue
            )
            SELECT
                product_id,
                total_revenue,
                CASE
                    WHEN grand_total = 0 THEN 'C'
                    WHEN (running_total - total_revenue) < grand_total * 0.8 THEN 'A'
                    WHEN (running_total - total_revenue) < grand_total * 0.95 THEN 'B'
                    ELSE 'C'
                END as new_abc_category
            FROM RankedProducts
        `,
      [clubId],
    );

    for (const row of revenueData.rows) {
      await client.query(
        `
                UPDATE warehouse_products
                SET abc_category = $1
                WHERE id = $2
            `,
        [row.new_abc_category, row.product_id],
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
  }
}

export async function getSalesAnalytics(clubId: string, limit: number = 500, monthStr?: string) {
  await requireClubAccess(clubId);
  let preferredMetricKey: string | null = null;
  try {
    const s = await query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId],
    );
    preferredMetricKey =
      s.rows[0]?.inventory_settings?.employee_default_metric_key || null;
  } catch {
    // Best effort: fall back to legacy keys.
  }
  // Get both sales and returns
  const res = await query(
    `
        SELECT
            sm.*,
            p.name as product_name,
            p.selling_price as current_price,
            p.cost_price as cost_price_snapshot,
            COALESCE(sm.price_at_time, p.selling_price) as price_at_time,
            u.full_name as user_name,
            su.full_name as shift_employee_name,
            s.check_in as shift_start,
            s.check_out as shift_end,
            s.id as shift_id_raw,
            COALESCE(
                CASE
                    WHEN (s.report_data ->> $3::text) ~ '^[0-9]+(\\.[0-9]+)?$' THEN (s.report_data ->> $3::text)::numeric
                    ELSE NULL
                END,
                CASE
                    WHEN (s.report_data ->> 'bar_revenue') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (s.report_data ->> 'bar_revenue')::numeric
                    ELSE NULL
                END,
                CASE
                    WHEN (s.report_data ->> 'total_revenue') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (s.report_data ->> 'total_revenue')::numeric
                    ELSE NULL
                END,
                inv.reported_revenue,
                0
            ) as shift_reported_revenue,
            inv.calculated_revenue as shift_calculated_revenue,
            inv.revenue_difference as shift_revenue_difference,
            -- Mark returns
            CASE WHEN sm.type = 'RETURN' THEN true ELSE false END as is_return,
            sm.reason as return_reason,
            sr.payment_type as receipt_payment_type,
            (SELECT full_name FROM users WHERE id = sr.salary_target_user_id) as salary_target_user_name
        FROM warehouse_stock_movements sm
        JOIN warehouse_products p ON sm.product_id = p.id
        LEFT JOIN users u ON sm.user_id = u.id
        LEFT JOIN shifts s ON sm.shift_id = s.id
        LEFT JOIN users su ON s.user_id = su.id
        LEFT JOIN LATERAL (
            SELECT
                wi.reported_revenue,
                wi.calculated_revenue,
                wi.revenue_difference
            FROM warehouse_inventories wi
            WHERE wi.shift_id = s.id
              AND wi.club_id = $1
            ORDER BY
                CASE WHEN wi.status = 'CLOSED' THEN 0 ELSE 1 END,
                wi.closed_at DESC NULLS LAST,
                wi.started_at DESC,
                wi.id DESC
            LIMIT 1
        ) inv ON TRUE
        -- Join for voided and non-revenue receipts
        LEFT JOIN shift_receipts sr ON sm.related_entity_type = 'SHIFT_RECEIPT' AND sm.related_entity_id = sr.id
        WHERE sm.club_id = $1
          AND sm.type IN ('SALE', 'RETURN')  -- Include both sales and returns
          AND COALESCE(sm.related_entity_type, '') != 'SHIFT_RECEIPT_VOID'
          AND (sr.id IS NULL OR sr.voided_at IS NULL)
          AND ($4::text IS NULL OR TO_CHAR(sm.created_at, 'YYYY-MM') = $4::text)
        ORDER BY sm.created_at DESC
        LIMIT $2
    `,
    [clubId, limit, preferredMetricKey, monthStr || null],
  );
  return res.rows;
}

export async function getMetrics() {
  await requireSessionUserId();
  const res = await query(
    `SELECT key, label FROM system_metrics WHERE type = 'MONEY' ORDER BY label`,
  );
  return res.rows as { key: string; label: string }[];
}

export async function getClubSettings(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT id, owner_id, inventory_settings
        FROM clubs
        WHERE id = $1
    `,
    [clubId],
  );
  return {
    ...res.rows[0],
    inventory_settings: normalizeInventorySettings(
      res.rows[0]?.inventory_settings,
    ),
  } as {
    id: number;
    owner_id: string;
    inventory_settings: NormalizedInventorySettings & {
      price_tag_template?: PriceTagTemplate;
      price_tag_settings?: PriceTagSettings;
    };
  };
}

export async function getAbcAnalysisData(clubId: string) {
  await requireClubAccess(clubId);
  const client = await getClient();
  try {
    const res = await client.query(
      `
            WITH ReceiptCosts AS (
                SELECT receipt_id, product_id, MAX(cost_price_snapshot) as cost_price_snapshot
                FROM shift_receipt_items
                GROUP BY receipt_id, product_id
            ),
            ProductRevenue AS (
                SELECT
                    p.id as product_id,
                    p.name,
                    p.abc_category,
                    p.current_stock,
                    p.sales_velocity,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'RETURN'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'SALE'
                                THEN ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            ELSE 0
                        END
                    ), 0) as total_revenue,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID' THEN -ABS(m.change_amount)
                            WHEN m.type = 'RETURN' THEN -ABS(m.change_amount)
                            WHEN m.type = 'SALE' THEN ABS(m.change_amount)
                            ELSE 0
                        END
                    ), 0) as total_sold,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'
                                THEN -ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - COALESCE(rc.cost_price_snapshot, p.cost_price))
                            WHEN m.type = 'RETURN'
                                THEN -ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - COALESCE(rc.cost_price_snapshot, p.cost_price))
                            WHEN m.type = 'SALE'
                                THEN ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - COALESCE(rc.cost_price_snapshot, p.cost_price))
                            ELSE 0
                        END
                    ), 0) as total_profit
                FROM warehouse_products p
                LEFT JOIN warehouse_stock_movements m ON p.id = m.product_id
                    AND m.type IN ('SALE', 'RETURN')
                    AND m.created_at > NOW() - INTERVAL '30 days'
                LEFT JOIN shift_receipts sr ON m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = sr.id
                LEFT JOIN ReceiptCosts rc ON rc.receipt_id = m.related_entity_id AND rc.product_id = p.id
                WHERE p.club_id = $1 AND p.is_active = true
                  AND COALESCE(sr.counts_in_revenue, true) = true
                GROUP BY p.id, p.name, p.abc_category, p.current_stock, p.sales_velocity
            ),
            TotalStats AS (
                SELECT SUM(total_revenue) as grand_total FROM ProductRevenue
            ),
            RankedProducts AS (
                SELECT
                    product_id,
                    name,
                    abc_category,
                    current_stock,
                    sales_velocity,
                    total_revenue,
                    total_sold,
                    total_profit,
                    (SELECT grand_total FROM TotalStats) as grand_total,
                    SUM(total_revenue) OVER (ORDER BY total_revenue DESC) as running_total
                FROM ProductRevenue
            )
            SELECT
                product_id,
                name,
                CASE
                    WHEN grand_total = 0 THEN 'C'
                    WHEN (running_total - total_revenue) < grand_total * 0.8 THEN 'A'
                    WHEN (running_total - total_revenue) < grand_total * 0.95 THEN 'B'
                    ELSE 'C'
                END as abc_category,
                total_revenue,
                total_sold,
                total_profit,
                CASE
                    WHEN total_revenue = 0 THEN 0
                    ELSE ROUND((total_profit / total_revenue * 100)::numeric, 1)
                END as margin_percent,
                CASE
                    WHEN sales_velocity = 0 THEN NULL
                    ELSE CEIL(current_stock / sales_velocity)
                END as days_left,
                grand_total,
                CASE
                    WHEN grand_total = 0 THEN 0
                    ELSE ROUND((total_revenue / NULLIF(grand_total, 0) * 100)::numeric, 2)
                END as revenue_share
            FROM RankedProducts
            WHERE total_revenue > 0
            ORDER BY total_revenue DESC
        `,
      [clubId],
    );

    return res.rows as {
      product_id: number;
      name: string;
      abc_category: string;
      total_revenue: number;
      total_sold: number;
      total_profit: number;
      margin_percent: number;
      days_left: number | null;
      grand_total: number;
      revenue_share: number;
    }[];
  } catch (err) {
    console.error(err);
    return [];
  } finally {
    client.release();
  }
}