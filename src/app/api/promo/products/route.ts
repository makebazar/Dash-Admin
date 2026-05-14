import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let clubId = searchParams.get("clubId");
    const getAll = searchParams.get("all") === "true";

    if (!clubId) {
      // Fallback to cookie if not in URL (for client-side calls without explicit ID)
      const cookieStore = await cookies();
      clubId = cookieStore.get("promo_active_club_id")?.value || null;
    }

    if (!clubId) {
      return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
    }

    // 1. Resolve internal ID and get settings
    const clubResult = await query(
      `SELECT id, name, promo_settings, inventory_settings FROM clubs WHERE id::text = $1 OR UPPER(public_id) = UPPER($1)`,
      [clubId],
    );

    if (!clubResult || (clubResult.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const club = clubResult.rows[0];
    const internalClubId = club.id;
    const promoSettings = club.promo_settings || {};
    const inventorySettings = club.inventory_settings || {};

    const barItems = Array.isArray(promoSettings.bar_items)
      ? promoSettings.bar_items
      : Array.isArray(promoSettings.barItems)
        ? promoSettings.barItems
        : [];

    const multiplier = Number(promoSettings.bonus_price_multiplier) || 2;

    // Resolve POS warehouses
    let cashboxWarehouseIds = Array.isArray(
      inventorySettings.cashbox_warehouse_ids,
    )
      ? inventorySettings.cashbox_warehouse_ids
      : [];

    // Fallback to default warehouse if no POS warehouses defined
    if (cashboxWarehouseIds.length === 0) {
      const defaultWh = await query(
        `SELECT id FROM warehouses WHERE club_id = $1 AND is_default = true LIMIT 1`,
        [internalClubId],
      );
      if (defaultWh.rows.length > 0) {
        cashboxWarehouseIds = [defaultWh.rows[0].id];
      }
    }

    // 2. Get products from warehouse_products
    let stockSubquery = `SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id`;
    let queryParams: any[] = [internalClubId];

    if (cashboxWarehouseIds.length > 0) {
      stockSubquery += ` AND warehouse_id = ANY($2::int[])`;
      queryParams.push(cashboxWarehouseIds);
    }

    const productsResult = await query(
      `SELECT p.id, p.name, p.selling_price, p.category_id, p.is_active,
       c.name as category_name,
       (${stockSubquery}) as total_stock
       FROM warehouse_products p
       LEFT JOIN warehouse_categories c ON p.category_id = c.id
       WHERE p.club_id = $1
         AND (p.deleted_at IS NULL OR p.deleted_at > NOW())
       ORDER BY c.name ASC, p.name ASC`,
      queryParams,
    );

    const allProducts = productsResult.rows.map((r) => ({
      ...r,
      total_stock: Number(r.total_stock) || 0,
      selling_price: Number(r.selling_price),
      is_active: r.is_active !== false, // normalize to boolean
    }));

    // Helper to check if item is enabled in bar_items
    const getBarConfig = (pid: any) => {
      return barItems.find((bi: any) => String(bi.id) === String(pid));
    };

    const isItemEnabled = (bi: any) => {
      if (!bi) return false;
      return bi.is_enabled === true || String(bi.is_enabled) === "true";
    };

    let finalProducts = [];
    if (getAll) {
      // ADMIN VIEW: Return everything
      finalProducts = allProducts.map((p) => {
        const barConfig = getBarConfig(p.id);
        return {
          ...p,
          bonus_price:
            Number(barConfig?.custom_bonus_price) ||
            Math.round(p.selling_price * multiplier),
          is_enabled: isItemEnabled(barConfig),
        };
      });
    } else {
      // CLIENT VIEW: Filter by is_enabled and is_active AND stock > 0
      finalProducts = allProducts
        .filter((p) => {
          const barConfig = getBarConfig(p.id);
          return isItemEnabled(barConfig) && p.is_active && p.total_stock > 0;
        })
        .map((p) => {
          const barConfig = getBarConfig(p.id);
          return {
            ...p,
            bonus_price:
              Number(barConfig?.custom_bonus_price) ||
              Math.round(p.selling_price * multiplier),
          };
        });
    }

    return NextResponse.json({
      success: true,
      products: finalProducts,
      _debug: {
        clubName: club.name,
        internalClubId,
        cashboxWarehouseIds,
        barItemsCount: barItems.length,
        totalWarehouseProducts: allProducts.length,
        enabledInSettingsCount: barItems.filter(isItemEnabled).length,
        first10Products: allProducts.slice(0, 10).map((p) => ({
          id: p.id,
          name: p.name,
          is_active: p.is_active,
          has_config: !!getBarConfig(p.id),
          is_enabled: isItemEnabled(getBarConfig(p.id)),
        })),
      },
    });
  } catch (error) {
    console.error("Promo Products Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
