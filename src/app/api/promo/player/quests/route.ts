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
         pq.current_progress,
         pq.status,
         pq.expires_at,
         pq.completed_at,
         pq.verification_photo_url,
         (q.min_level > COALESCE(current_lvl.level_number, 1)) as is_level_locked
       FROM promo_quests q
       LEFT JOIN promo_player_quests pq ON pq.quest_id = q.id AND pq.player_id = $1
       JOIN promo_player_balances pb ON pb.player_id = $1 AND pb.club_id = $2
       JOIN clubs c ON c.id = pb.club_id
       LEFT JOIN LATERAL (
         SELECT level_number
         FROM promo_levels
         WHERE club_id = $2 AND xp_required <= pb.total_xp
         ORDER BY level_number DESC
         LIMIT 1
       ) AS current_lvl ON TRUE
       WHERE q.club_id = $2
         AND q.is_active = TRUE
         AND (q.is_randomizable = FALSE OR pq.id IS NOT NULL)
         AND (q.available_days IS NULL OR (EXTRACT(DOW FROM timezone(COALESCE(c.timezone, 'Europe/Moscow'), now()))) = ANY(q.available_days))
         AND (q.time_start IS NULL OR (timezone(COALESCE(c.timezone, 'Europe/Moscow'), now()))::TIME >= q.time_start)
         AND (q.time_end IS NULL OR (timezone(COALESCE(c.timezone, 'Europe/Moscow'), now()))::TIME <= q.time_end)
       ORDER BY
         is_level_locked ASC,
         CASE WHEN pq.status = 'active' THEN 0 WHEN pq.status IS NULL THEN 1 ELSE 2 END,
         q.created_at DESC`,
      [playerId, activeClubId],
    );

    let quests = res.rows;

    // 4. Filter and dynamic target resolution
    const finalQuests = [];

    // Fetch bar items and stock to check availability
    const productsRes = await client.query(
      `SELECT p.id, p.name, p.category_id,
              (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id) as stock
       FROM warehouse_products p
       WHERE p.club_id = $1 AND (p.deleted_at IS NULL OR p.deleted_at > NOW()) AND p.is_active = TRUE`,
      [activeClubId],
    );
    const allProducts = productsRes.rows;

    // Fetch club promo settings for bar_items filter
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

    for (const q of quests) {
      if (q.trigger_type === "receipt_item" && q.target_entity_id) {
        if (q.target_entity_id_type === "category") {
          // Dynamic category target
          const categoryId = Number(q.target_entity_id);
          const availableProduct = allProducts.find(
            (p) =>
              p.category_id === categoryId &&
              Number(p.stock) > 0 &&
              isEnabledInBar(p.id),
          );

          if (!availableProduct) continue; // Hide if no items available in category

          // Update quest data for the player
          q.title = q.title.replace("{{product}}", availableProduct.name);
          q.description = q.description.replace(
            "{{product}}",
            availableProduct.name,
          );
          q.resolved_target_product_id = availableProduct.id;
        } else {
          // Specific product target
          const productId = Number(q.target_entity_id);
          const product = allProducts.find((p) => p.id === productId);

          if (
            !product ||
            Number(product.stock) <= 0 ||
            !isEnabledInBar(productId)
          ) {
            continue; // Hide if product out of stock or disabled
          }

          q.title = q.title.replace("{{product}}", product.name);
          q.description = q.description.replace("{{product}}", product.name);
        }
      }
      finalQuests.push(q);
    }

    return NextResponse.json({ quests: finalQuests });
  } catch (error) {
    console.error("Promo Player Quests Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
