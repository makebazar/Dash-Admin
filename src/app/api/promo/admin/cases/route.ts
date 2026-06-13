import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const casesRes = await query(
      `SELECT * FROM promo_cases WHERE club_id = $1 ORDER BY id ASC`,
      [clubId]
    );

    const cases = casesRes.rows;

    for (const c of cases) {
      const itemsRes = await query(
        `SELECT * FROM promo_case_items WHERE case_id = $1 ORDER BY id ASC`,
        [c.id]
      );
      c.items = itemsRes.rows;
    }

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Admin Fetch Cases Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let client;
  try {
    const { id, clubId, name, description, price_bonus, rtp, image_url, is_active, items } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    client = await getClient();
    await client.query("BEGIN");

    let caseId = id;
    if (caseId) {
      await client.query(
        `UPDATE promo_cases 
         SET name = $1, description = $2, price_bonus = $3, rtp = $4, image_url = $5, is_active = $6, updated_at = NOW()
         WHERE id = $7 AND club_id = $8`,
        [name, description, parseFloat(price_bonus), parseFloat(rtp), image_url, is_active, caseId, clubId]
      );
    } else {
      const insertCaseRes = await client.query(
        `INSERT INTO promo_cases (club_id, name, description, price_bonus, rtp, image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [clubId, name, description, parseFloat(price_bonus), parseFloat(rtp), image_url, is_active]
      );
      caseId = insertCaseRes.rows[0].id;
    }

    if (items && Array.isArray(items)) {
      const newItemsIds = items.map(item => item.id).filter(Boolean);
      
      if (newItemsIds.length > 0) {
        await client.query(
          `DELETE FROM promo_case_items WHERE case_id = $1 AND id NOT IN (${newItemsIds.map((_, i) => `$${i + 2}`).join(",")})`,
          [caseId, ...newItemsIds]
        );
      } else {
        await client.query(
          `DELETE FROM promo_case_items WHERE case_id = $1`,
          [caseId]
        );
      }

      for (const item of items) {
        if (item.id) {
          await client.query(
            `UPDATE promo_case_items 
             SET name = $1, description = $2, reward_type = $3, reward_value = $4, 
                 bar_product_id = $5, bar_category_id = $6, club_service_id = $7, 
                 image_url = $8, weight = $9, is_rare = $10
             WHERE id = $11 AND case_id = $12`,
            [
              item.name,
              item.description,
              item.reward_type,
              parseFloat(item.reward_value),
              item.bar_product_id || null,
              item.bar_category_id || null,
              item.club_service_id || null,
              item.image_url,
              parseInt(item.weight),
              item.is_rare || false,
              item.id,
              caseId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO promo_case_items (case_id, name, description, reward_type, reward_value, 
                                          bar_product_id, bar_category_id, club_service_id, image_url, weight, is_rare)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              caseId,
              item.name,
              item.description,
              item.reward_type,
              parseFloat(item.reward_value),
              item.bar_product_id || null,
              item.bar_category_id || null,
              item.club_service_id || null,
              item.image_url,
              parseInt(item.weight),
              item.is_rare || false
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true, caseId });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Admin Save Case Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("id");
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId || !caseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await query(
      `DELETE FROM promo_cases WHERE id = $1 AND club_id = $2`,
      [parseInt(caseId), parseInt(clubId)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin Delete Case Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
