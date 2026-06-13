import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const clubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const casesRes = await query(
      `SELECT * FROM promo_cases WHERE club_id = $1 AND is_active = TRUE ORDER BY price_bonus ASC`,
      [parseInt(clubId)]
    );
    const cases = casesRes.rows;

    for (const c of cases) {
      const itemsRes = await query(
        `SELECT id, name, description, reward_type, reward_value, bar_product_id, bar_category_id, club_service_id, image_url, weight, is_rare 
         FROM promo_case_items 
         WHERE case_id = $1 
         ORDER BY id ASC`,
        [c.id]
      );
      c.items = itemsRes.rows;
    }

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Player Fetch Cases Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let client;
  try {
    const { caseId } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const clubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !clubId || !caseId) {
      return NextResponse.json({ error: "Unauthorized or missing parameters" }, { status: 401 });
    }

    client = await getClient();
    await client.query("BEGIN");

    const balanceRes = await client.query(
      `SELECT bonus_balance FROM promo_player_balances 
       WHERE player_id = $1 AND club_id = $2 FOR UPDATE`,
      [playerId, parseInt(clubId)]
    );

    if (balanceRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Player balance record not found" }, { status: 404 });
    }

    const balance = parseFloat(balanceRes.rows[0].bonus_balance || 0);

    const caseRes = await client.query(
      `SELECT price_bonus, name, is_active FROM promo_cases WHERE id = $1 AND club_id = $2`,
      [parseInt(caseId), parseInt(clubId)]
    );

    if (caseRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const caseData = caseRes.rows[0];
    if (!caseData.is_active) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Case is not active" }, { status: 400 });
    }

    const price = parseFloat(caseData.price_bonus);
    if (balance < price) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Insufficient bonus balance" }, { status: 400 });
    }

    const itemsRes = await client.query(
      `SELECT * FROM promo_case_items WHERE case_id = $1`,
      [parseInt(caseId)]
    );

    if (itemsRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This case has no drop items configured" }, { status: 400 });
    }

    const items = itemsRes.rows;

    // Fetch product stock levels for all specific bar items (from warehouse_products)
    const productIds = items
      .filter(item => item.reward_type === 'bar_item' && item.bar_product_id)
      .map(item => item.bar_product_id);

    let productStocks: Record<number, number> = {};
    if (productIds.length > 0) {
      const stockRes = await client.query(
        `SELECT id, COALESCE(current_stock, 0) as quantity 
         FROM warehouse_products 
         WHERE id IN (${productIds.map((_, i) => `$${i + 1}`).join(",")}) 
           AND club_id = $${productIds.length + 1} AND deleted_at IS NULL`,
        [...productIds, parseInt(clubId)]
      );
      productStocks = stockRes.rows.reduce((acc, row) => {
        acc[row.id] = parseFloat(row.quantity);
        return acc;
      }, {} as Record<number, number>);
    }

    // Fetch available products for categories (random from warehouse_products)
    const categoryIds = items
      .filter(item => item.reward_type === 'bar_category' && item.bar_category_id)
      .map(item => item.bar_category_id);

    let categoryProducts: Record<number, any[]> = {};
    if (categoryIds.length > 0) {
      const catProductsRes = await client.query(
        `SELECT id, name, category_id, 
                COALESCE(current_stock, 0) as quantity, 
                COALESCE(selling_price, 0) as price 
         FROM warehouse_products 
         WHERE club_id = $1
           AND category_id = ANY($2::int[])
           AND COALESCE(current_stock, 0) > 0
           AND deleted_at IS NULL AND is_active = true`,
        [parseInt(clubId), categoryIds]
      );
      categoryProducts = catProductsRes.rows.reduce((acc, row) => {
        if (!acc[row.category_id]) acc[row.category_id] = [];
        acc[row.category_id].push(row);
        return acc;
      }, {} as Record<number, any[]>);
    }

    // Filter items that are in stock
    const eligibleItems = items.filter(item => {
      if (item.reward_type === 'bar_item') {
        const stock = productStocks[item.bar_product_id] ?? 0;
        return stock > 0;
      }
      if (item.reward_type === 'bar_category') {
        const productsInCat = categoryProducts[item.bar_category_id] || [];
        return productsInCat.length > 0;
      }
      return true;
    });

    if (eligibleItems.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Все призы в данном кейсе временно закончились (нет на складе)" }, { status: 400 });
    }

    const totalWeight = eligibleItems.reduce((acc, item) => acc + parseInt(item.weight || 0), 0);
    if (totalWeight <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Case items weight configuration error" }, { status: 400 });
    }

    let randomValue = Math.floor(Math.random() * totalWeight) + 1;
    let wonItem = null;

    for (const item of eligibleItems) {
      randomValue -= parseInt(item.weight || 0);
      if (randomValue <= 0) {
        wonItem = { ...item };
        break;
      }
    }

    if (!wonItem) {
      wonItem = { ...eligibleItems[eligibleItems.length - 1] };
    }

    // If it's a category random drop, resolve to a specific product
    let chosenProductId: number | null = null;
    if (wonItem.reward_type === 'bar_category') {
      const productsInCat = categoryProducts[wonItem.bar_category_id] || [];
      const randomProdIdx = Math.floor(Math.random() * productsInCat.length);
      const chosenProduct = productsInCat[randomProdIdx];
      
      wonItem.name = chosenProduct.name;
      wonItem.reward_value = parseFloat(chosenProduct.price);
      chosenProductId = chosenProduct.id;
    } else if (wonItem.reward_type === 'bar_item') {
      chosenProductId = wonItem.bar_product_id;
    }

    // Deduct price
    await client.query(
      `UPDATE promo_player_balances 
       SET bonus_balance = bonus_balance - $1, updated_at = NOW() 
       WHERE player_id = $2 AND club_id = $3`,
      [price, playerId, parseInt(clubId)]
    );

    // Add to inventory
    const inventoryInsertRes = await client.query(
      `INSERT INTO promo_player_inventory (player_id, club_id, item_id, status, bar_product_id)
       VALUES ($1, $2, $3, 'acquired', $4)
       RETURNING id`,
      [playerId, parseInt(clubId), wonItem.id, chosenProductId]
    );
    const inventoryId = inventoryInsertRes.rows[0].id;

    // Log history
    await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
       VALUES ($1, $2, 'CASE_OPEN', $3)`,
      [
        playerId,
        parseInt(clubId),
        JSON.stringify({
          case_id: caseId,
          case_name: caseData.name,
          cost: price,
          won_item_id: wonItem.id,
          won_item_name: wonItem.name,
          inventory_id: inventoryId,
        }),
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      wonItem: {
        id: wonItem.id,
        name: wonItem.name,
        description: wonItem.description,
        reward_type: wonItem.reward_type,
        reward_value: wonItem.reward_value,
        image_url: wonItem.image_url,
        is_rare: wonItem.is_rare,
      },
      inventoryId,
      newBalance: balance - price,
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Player Open Case Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
