import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

// GET /api/clubs/[clubId]/finance/settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "view");

    const result = await query(
      `SELECT * FROM club_finance_settings WHERE club_id = $1`,
      [clubId]
    );

    if (result.rows.length === 0) {
      // Return defaults if not set yet
      return NextResponse.json({
        settings: {
          club_id: parseInt(clubId),
          tax_regime: "patent_usn6",
          custom_tax_rate: 6.0,
          patent_cost: 12500.0,
          limit_exceeded: false,
          usn_categories: []
        }
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      settings: {
        club_id: row.club_id,
        tax_regime: row.tax_regime,
        custom_tax_rate: parseFloat(row.custom_tax_rate || 6),
        patent_cost: parseFloat(row.patent_cost || 12500),
        limit_exceeded: Boolean(row.limit_exceeded),
        usn_categories: Array.isArray(row.usn_categories) ? row.usn_categories : (row.usn_categories ? JSON.parse(row.usn_categories) : [])
      }
    });
  } catch (error: any) {
    console.error("Failed to fetch finance settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch finance settings" },
      { status: 500 }
    );
  }
}

// POST /api/clubs/[clubId]/finance/settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "finance", "edit");

    const body = await request.json();
    const {
      tax_regime = "patent_usn6",
      custom_tax_rate = 6.0,
      patent_cost = 12500.0,
      limit_exceeded = false,
      usn_categories = []
    } = body;

    const upsertResult = await query(
      `INSERT INTO club_finance_settings 
        (club_id, tax_regime, custom_tax_rate, patent_cost, limit_exceeded, usn_categories, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       ON CONFLICT (club_id) DO UPDATE SET
        tax_regime = EXCLUDED.tax_regime,
        custom_tax_rate = EXCLUDED.custom_tax_rate,
        patent_cost = EXCLUDED.patent_cost,
        limit_exceeded = EXCLUDED.limit_exceeded,
        usn_categories = EXCLUDED.usn_categories,
        updated_at = NOW()
       RETURNING *`,
      [
        clubId,
        tax_regime,
        custom_tax_rate,
        patent_cost,
        limit_exceeded,
        JSON.stringify(usn_categories)
      ]
    );

    const row = upsertResult.rows[0];
    return NextResponse.json({
      success: true,
      settings: {
        club_id: row.club_id,
        tax_regime: row.tax_regime,
        custom_tax_rate: parseFloat(row.custom_tax_rate || 6),
        patent_cost: parseFloat(row.patent_cost || 12500),
        limit_exceeded: Boolean(row.limit_exceeded),
        usn_categories: Array.isArray(row.usn_categories) ? row.usn_categories : JSON.parse(row.usn_categories || "[]")
      }
    });
  } catch (error: any) {
    console.error("Failed to save finance settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save finance settings" },
      { status: 500 }
    );
  }
}
