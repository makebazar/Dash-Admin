import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await client.query(
      `SELECT
         q.id,
         q.title,
         q.description,
         q.trigger_type,
         q.target_entity_id,
         q.target_entity_id_type,
         q.target_value,
         q.reward_xp,
         q.reward_tickets,
         q.reward_bonus_balance,
         q.is_randomizable,
         q.action_button_text,
         q.action_button_url,
         q.requires_photo_verification,
         q.min_level,
         q.target_service_id,
         pq.current_progress,
         pq.status,
         pq.expires_at,
         pq.completed_at,
         pq.verification_photo_url,
         pq.period_start,
         q.reset_period,
         q.reset_hours,
         (q.min_level > COALESCE(current_lvl.level_number, 1)) as is_level_locked
       FROM promo_quests q
       LEFT JOIN LATERAL (
         SELECT current_progress, status, expires_at, completed_at, verification_photo_url, period_start, id
         FROM promo_player_quests
         WHERE quest_id = q.id AND player_id = $1
         ORDER BY assigned_at DESC
         LIMIT 1
       ) pq ON TRUE
       LEFT JOIN promo_player_balances pb ON pb.player_id = $1 AND pb.club_id = $2
       JOIN clubs c ON c.id = $2
       LEFT JOIN LATERAL (
         SELECT level_number
         FROM promo_levels
         WHERE club_id = $2 AND xp_required <= COALESCE(pb.total_xp, 0)
         ORDER BY level_number DESC
         LIMIT 1
       ) AS current_lvl ON TRUE
       WHERE q.club_id = $2
         AND q.is_active = TRUE
         AND (q.is_randomizable = FALSE OR pq.id IS NOT NULL)
       ORDER BY
         is_level_locked ASC,
         CASE WHEN pq.status = 'active' THEN 0 WHEN pq.status IS NULL THEN 1 ELSE 2 END,
         q.created_at DESC`,
      [playerId, activeClubId],
    );

    const quests = res.rows;
    const finalQuests = [];

    const productsRes = await client.query(
      `SELECT p.id, p.name, p.category_id,
              (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id) as stock
       FROM warehouse_products p
       WHERE p.club_id = $1 AND (p.deleted_at IS NULL OR p.deleted_at > NOW()) AND p.is_active = TRUE`,
      [activeClubId],
    );
    const allProducts = productsRes.rows;

    const clubSettingsRes = await client.query(
      `SELECT promo_settings FROM clubs WHERE id = $1`,
      [activeClubId],
    );
    const promoSettings = clubSettingsRes.rows[0]?.promo_settings || {};
    const barItems = Array.isArray(promoSettings.bar_items)
      ? promoSettings.bar_items
      : [];

    const isEnabledInBar = (pid: number) => {
      const bi = barItems.find((b: any) => String(b.id) === String(pid));
      return bi && (bi.is_enabled === true || String(bi.is_enabled) === "true");
    };

    // Fetch player's service purchases for today from promo_history
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const playerSalesRes = await client.query(
      `SELECT result_data->>'rule_id' as rule_id
       FROM promo_history
       WHERE player_id = $1::uuid AND game_type = 'SERVICE_AWARD' AND created_at >= $2`,
      [playerId, today],
    );
    const purchasedServiceIds = new Set(
      playerSalesRes.rows.map((r) => String(r.rule_id)),
    );

    for (const q of quests) {
      // Initialize units
      q.quest_unit = "шт.";
      if (
        ["receipt_total", "total_spent_accumulative", "balance_topup"].includes(
          q.trigger_type,
        )
      ) {
        q.quest_unit = "₽";
      }

      // Handle required service metadata
      if (q.target_service_id) {
        const serviceRules = Array.isArray(promoSettings.service_rules)
          ? promoSettings.service_rules
          : [];
        const service = serviceRules.find(
          (s: any) => String(s.id) === String(q.target_service_id),
        );
        if (service) {
          q.required_service_name = service.name;
          q.is_service_purchased = purchasedServiceIds.has(
            String(q.target_service_id),
          );
        }
      }

      // Process product/category names
      if (
        q.trigger_type === "receipt_item" &&
        q.target_entity_id &&
        q.target_entity_id.trim() !== ""
      ) {
        if (q.target_entity_id_type === "category") {
          const categoryId = Number(q.target_entity_id);
          const availableProduct = allProducts.find(
            (p) =>
              p.category_id === categoryId &&
              Number(p.stock) > 0 &&
              isEnabledInBar(p.id),
          );

          if (availableProduct) {
            q.title = (q.title || "").replace(
              "{{product}}",
              availableProduct.name,
            );
            q.description = (q.description || "").replace(
              "{{product}}",
              availableProduct.name,
            );
            q.resolved_target_product_id = availableProduct.id;
          }
        } else {
          const targetIds = String(q.target_entity_id)
            .split(",")
            .map((id) => Number(id.trim()))
            .filter((id) => !isNaN(id));
          const products = allProducts.filter((p) => targetIds.includes(p.id));

          if (products.length > 0) {
            const productNames = products.map((p) => p.name).join(" + ");
            q.title = (q.title || "").split("{{product}}").join(productNames);
            q.description = (q.description || "")
              .split("{{product}}")
              .join(productNames);
            if (targetIds.length > 1) q.quest_unit = "компл.";
          }
        }
      }

      finalQuests.push(q);
    }

    return NextResponse.json({ quests: finalQuests });
  } catch (error) {
    console.error("Promo Player Quests Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
