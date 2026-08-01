import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubApiAccess } from "@/lib/club-api-access";

// GraphQL helper
async function callDashLockGraphQL(dashlockUrl: string, queryStr: string, variables: any = {}) {
  const baseUrl = dashlockUrl.replace(/\/$/, "");
  const graphqlUrl = `${baseUrl}/graphql`;

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: queryStr,
      variables,
    }),
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 0 }
  });

  if (!res.ok) {
    throw new Error(`DashLock HTTP error: ${res.status}`);
  }

  const body = await res.json();
  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors[0].message);
  }

  return body.data;
}

// GET: Fetch player details and history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  try {
    const { clubId, playerId } = await params;
    await requireClubApiAccess(clubId);

    // Load inventory settings to check if integration is enabled
    const clubSettingsResult = await query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );

    const inventorySettings = clubSettingsResult.rows[0]?.inventory_settings || {};
    const isDashLockEnabled = Boolean(inventorySettings.dashlock_integration_enabled);
    const dashlockUrl = inventorySettings.dashlock_url || "http://localhost:47200";

    if (!isDashLockEnabled) {
      return NextResponse.json(
        { error: "Интеграция DashLock отключена для этого клуба" },
        { status: 400 }
      );
    }

    try {
      const data = await callDashLockGraphQL(
        dashlockUrl,
        `
        query($id: String!, $playerId: String!) {
          player(id: $id) {
            id
            phone
            fullName
            balance
            bonusBalance
            totalHours
            totalSpent
            visitsCount
            tier
            loyaltyTierId
            promisedPaymentAllowed
          }
          playerHistory(playerId: $playerId) {
            totalHours
            totalSpent
            sessions {
              id
              workstationId
              startedAt
              endedAt
              status
              totalAmount
              paidAmount
            }
            transactions {
              id
              type
              amount
              paymentMethod
              description
              createdAt
            }
          }
          getLoyaltyTiers {
            id
            name
          }
        }
        `,
        { id: playerId, playerId }
      );

      return NextResponse.json({
        success: true,
        player: data.player,
        history: data.playerHistory,
        loyaltyTiers: data.getLoyaltyTiers || []
      });

    } catch (remoteError: any) {
      console.error("Failed to fetch player details from DashLock:", remoteError);
      return NextResponse.json(
        { error: `Ошибка получения данных от DashLock: ${remoteError.message}` },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error("GET Player Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: Edit player profile
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  try {
    const { clubId, playerId } = await params;
    await requireClubApiAccess(clubId);

    const body = await request.json();
    const { fullName, balance, bonusBalance, phone, loyaltyTierId, promisedPaymentAllowed } = body;

    const clubSettingsResult = await query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );

    const inventorySettings = clubSettingsResult.rows[0]?.inventory_settings || {};
    const dashlockUrl = inventorySettings.dashlock_url || "http://localhost:47200";

    try {
      const data = await callDashLockGraphQL(
        dashlockUrl,
        `
        mutation($id: String!, $fullName: String!, $balance: Float!, $bonusBalance: Float!, $phone: String!, $loyaltyTierId: Int, $promisedPaymentAllowed: Boolean!) {
          updatePlayerProfile(id: $id, fullName: $fullName, balance: $balance, bonusBalance: $bonusBalance, phone: $phone, loyaltyTierId: $loyaltyTierId, promisedPaymentAllowed: $promisedPaymentAllowed) {
            id
            fullName
            phone
            balance
            bonusBalance
          }
        }
        `,
        {
          id: playerId,
          fullName,
          balance: parseFloat(balance || 0),
          bonusBalance: parseFloat(bonusBalance || 0),
          phone,
          loyaltyTierId: loyaltyTierId ? parseInt(loyaltyTierId) : null,
          promisedPaymentAllowed: Boolean(promisedPaymentAllowed)
        }
      );

      return NextResponse.json({
        success: true,
        player: data.updatePlayerProfile
      });

    } catch (remoteError: any) {
      console.error("Failed to update player profile in DashLock:", remoteError);
      return NextResponse.json(
        { error: `Ошибка обновления профиля: ${remoteError.message}` },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error("PATCH Player Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Execute specific player actions (deposit, deposit bonus, reset pin)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  try {
    const { clubId, playerId } = await params;
    await requireClubApiAccess(clubId);

    const body = await request.json();
    const { action } = body;

    const clubSettingsResult = await query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );

    const inventorySettings = clubSettingsResult.rows[0]?.inventory_settings || {};
    const dashlockUrl = inventorySettings.dashlock_url || "http://localhost:47200";

    // 1. Resolve a valid staff member from DashLock to act as transaction author
    let staffId = "00000000-0000-0000-0000-000000000000";
    try {
      const staffData = await callDashLockGraphQL(dashlockUrl, `query { getAllStaff { id } }`);
      if (staffData.getAllStaff && staffData.getAllStaff.length > 0) {
        staffId = staffData.getAllStaff[0].id;
      }
    } catch (staffErr) {
      console.warn("Could not load staff list for action, falling back to dummy UUID", staffErr);
    }

    try {
      if (action === "deposit") {
        const { amount, paymentMethod } = body;
        const data = await callDashLockGraphQL(
          dashlockUrl,
          `
          mutation($playerId: String!, $amount: Float!, $staffId: String!, $paymentMethod: String) {
            depositBalance(playerId: $playerId, amount: $amount, staffId: $staffId, paymentMethod: $paymentMethod) {
              id
              balance
            }
          }
          `,
          {
            playerId,
            amount: parseFloat(amount || 0),
            staffId,
            paymentMethod: paymentMethod || "cash"
          }
        );
        return NextResponse.json({ success: true, player: data.depositBalance });

      } else if (action === "deposit-bonus") {
        const { amount, comment } = body;
        const data = await callDashLockGraphQL(
          dashlockUrl,
          `
          mutation($playerId: String!, $amount: Float!, $staffId: String!, $comment: String!) {
            depositBonusBalance(playerId: $playerId, amount: $amount, staffId: $staffId, comment: $comment) {
              id
              bonusBalance
            }
          }
          `,
          {
            playerId,
            amount: parseFloat(amount || 0),
            staffId,
            comment: comment || "Администратор"
          }
        );
        return NextResponse.json({ success: true, player: data.depositBonusBalance });

      } else if (action === "reset-pin") {
        const { tempPin } = body;
        await callDashLockGraphQL(
          dashlockUrl,
          `
          mutation($playerId: String!, $tempPin: String!) {
            resetPlayerPin(playerId: $playerId, tempPin: $tempPin)
          }
          `,
          {
            playerId,
            tempPin: String(tempPin)
          }
        );
        return NextResponse.json({ success: true });

      } else {
        return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
      }

    } catch (remoteError: any) {
      console.error(`Failed to execute action ${action} in DashLock:`, remoteError);
      return NextResponse.json(
        { error: `Ошибка выполнения операции: ${remoteError.message}` },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error("POST Player Action Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
