import { NextResponse } from "next/server";
import crypto from "crypto";
import { query, getClient } from "@/db";

const normalizePeriodUnit = (value: string | null | undefined) => {
  if (value === "day" || value === "month" || value === "year") return value;
  return "month";
};

const addPeriod = (base: Date, unit: string, value: number) => {
  const next = new Date(base);
  if (unit === "day") {
    next.setDate(next.getDate() + value);
    return next;
  }
  if (unit === "year") {
    next.setFullYear(next.getFullYear() + value);
    return next;
  }
  next.setMonth(next.getMonth() + value);
  return next;
};

// HMAC-SHA256 signature verification helper
function verifySignature(bodyText: string, receivedHmac: string | null, secret: string): boolean {
  if (!receivedHmac) return false;
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(bodyText);
    const computedHmac = hmac.digest("base64");
    return computedHmac === receivedHmac;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const event = searchParams.get("event")?.toLowerCase();

    // Read raw body for signature verification
    const bodyText = await request.text();
    const receivedHmac = request.headers.get("content-hmac");

    // Secret key for CloudPayments verification
    // Default to a test key if not set to allow easy setup
    const secret = process.env.CLOUDPAYMENTS_SECRET_KEY || "test_secret_key";

    // HMAC Signature Verification
    if (process.env.NODE_ENV === "production" || process.env.CLOUDPAYMENTS_SECRET_KEY) {
      const isValid = verifySignature(bodyText, receivedHmac, secret);
      if (!isValid) {
        console.error("CloudPayments signature mismatch. Received HMAC:", receivedHmac);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Parse body text (support JSON and Form URL-encoded)
    let data: any;
    try {
      if (bodyText.trim().startsWith("{")) {
        data = JSON.parse(bodyText);
      } else {
        data = Object.fromEntries(new URLSearchParams(bodyText).entries());
      }
    } catch (parseError) {
      console.error("Failed to parse body:", parseError);
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    // 0. Handle RECURRENT status changes separately (since they might not contain a specific transaction InvoiceId)
    if (event === "recurrent") {
      const subscriptionStatus = String(data.Status || data.status || "").toLowerCase();
      const accountId = data.AccountId || data.accountId;
      console.log(`Recurrent webhook received: status = ${subscriptionStatus}, accountId = ${accountId}`);

      if (subscriptionStatus === "cancelled" || subscriptionStatus === "rejected" || subscriptionStatus === "expired" || subscriptionStatus === "pastdue") {
        const nextStatus = "expired"; // Force status to expired to restrict access
        if (accountId) {
          await query(
            `UPDATE clubs
             SET subscription_status = $1,
                 subscription_ends_at = NOW()
             WHERE owner_id = $2`,
            [nextStatus, accountId]
          );
          console.log(`Updated clubs for owner ${accountId} to expired due to recurrent status: ${subscriptionStatus}`);
        }
      } else if (subscriptionStatus === "active") {
        if (accountId) {
          await query(
            `UPDATE clubs
             SET subscription_status = 'active'
             WHERE owner_id = $1`,
            [accountId]
          );
          console.log(`Updated clubs for owner ${accountId} to active due to recurrent status: ${subscriptionStatus}`);
        }
      }
      return NextResponse.json({ code: 0 });
    }

    // Capture critical variables case-insensitively
    const invoiceIdStr = data.InvoiceId || data.invoiceId;
    const amountStr = data.Amount || data.amount;
    const transactionId = data.TransactionId || data.transactionId;
    const paymentMethod = data.PaymentMethod || data.paymentMethod || "Card";

    if (!invoiceIdStr) {
      console.error("Missing InvoiceId in CloudPayments webhook payload");
      return NextResponse.json({ code: 10 }); // 10 = Invalid order number
    }

    const orderId = Number(invoiceIdStr);
    if (isNaN(orderId)) {
      console.error("InvoiceId is not a valid number:", invoiceIdStr);
      return NextResponse.json({ code: 10 });
    }

    // Look up the order in our database
    const orderRes = await query(
      `SELECT id, club_id, user_id, plan_code, amount, status, period_unit, period_value 
       FROM subscription_orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      console.error("Order not found for ID:", orderId);
      return NextResponse.json({ code: 10 }); // 10 = Invalid order number
    }

    const order = orderRes.rows[0];

    // Check Event Type
    if (event === "check") {
      // 1. CHECK EVENT (Pre-authorization validation)
      if (order.status !== "pending") {
        console.warn(`Order ${orderId} is not in pending status, current: ${order.status}`);
        return NextResponse.json({ code: 13 }); // 13 = General error/Cannot accept
      }

      // Check amount
      const orderAmount = Number(order.amount);
      const incomingAmount = Number(amountStr);
      if (Math.abs(orderAmount - incomingAmount) > 0.01) {
        console.error(`Amount mismatch for order ${orderId}: Expected ${orderAmount}, got ${incomingAmount}`);
        return NextResponse.json({ code: 12 }); // 12 = Invalid amount
      }

      console.log(`CloudPayments check passed for order ${orderId}, amount: ${orderAmount}`);
      return NextResponse.json({ code: 0 }); // 0 = Accept payment
    }

    if (event === "pay") {
      // 2. PAY EVENT (Payment captured successfully)
      if (order.status === "paid") {
        // Idempotency: already updated
        console.log(`Order ${orderId} already processed as paid.`);
        return NextResponse.json({ code: 0 });
      }

      // Update Database transactionally
      const client = await getClient();
      try {
        await client.query("BEGIN");

        // Update Order
        await client.query(
          `UPDATE subscription_orders
           SET status = 'paid',
               external_id = $1,
               payment_method = $2,
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [transactionId ? String(transactionId) : null, paymentMethod, orderId]
        );

        // Calculate next subscription expiration date
        const now = new Date();
        const nextEndsAt = addPeriod(
          now,
          normalizePeriodUnit(order.period_unit),
          Number(order.period_value || 1)
        );

        // Update Club's Subscription Details
        if (order.club_id) {
          const nextStatus = order.plan_code === "new_user" ? "trialing" : "active";
          
          await client.query(
            `UPDATE clubs
             SET subscription_plan = $1,
                 subscription_status = $2,
                 subscription_started_at = CASE 
                     WHEN subscription_status = 'trialing' OR subscription_status = 'expired' 
                     THEN NOW() 
                     ELSE COALESCE(subscription_started_at, NOW()) 
                 END,
                 subscription_ends_at = $3,
                 subscription_canceled_at = NULL
             WHERE id = $4`,
            [order.plan_code, nextStatus, nextEndsAt.toISOString(), order.club_id]
          );

          console.log(`Club ${order.club_id} subscription successfully updated to plan: ${order.plan_code}, ends at: ${nextEndsAt.toISOString()}`);
        } else {
          // If no specific club_id, update user's profile subscription (Legacy/Fallback)
          const nextStatus = order.plan_code === "new_user" ? "trialing" : "active";
          
          await client.query(
            `UPDATE users
             SET subscription_plan = $1,
                 subscription_status = $2,
                 subscription_started_at = CASE 
                     WHEN subscription_status = 'trialing' OR subscription_status = 'expired' 
                     THEN NOW() 
                     ELSE COALESCE(subscription_started_at, NOW()) 
                 END,
                 subscription_ends_at = $3,
                 subscription_canceled_at = NULL
             WHERE id = $4`,
            [order.plan_code, nextStatus, nextEndsAt.toISOString(), order.user_id]
          );

          console.log(`User ${order.user_id} global subscription successfully updated to plan: ${order.plan_code}`);
        }

        await client.query("COMMIT");
        console.log(`Transaction successfully committed for order: ${orderId}`);
      } catch (dbError) {
        await client.query("ROLLBACK");
        console.error("Database transaction failed during webhook:", dbError);
        return NextResponse.json({ error: "Internal Database Error" }, { status: 500 });
      } finally {
        client.release();
      }

      return NextResponse.json({ code: 0 });
    }

    if (event === "fail") {
      // 3. FAIL EVENT (Payment failed)
      await query(
        `UPDATE subscription_orders
         SET status = 'failed',
             external_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [transactionId ? String(transactionId) : null, orderId]
      );
      
      console.log(`Order ${orderId} marked as failed from CloudPayments webhook.`);
      return NextResponse.json({ code: 0 });
    }

    if (event === "refund") {
      // 4. REFUND EVENT (Payment refunded)
      await query(
        `UPDATE subscription_orders
         SET status = 'refunded',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );
      if (order.club_id) {
        await query(
          `UPDATE clubs
           SET subscription_status = 'expired',
               subscription_ends_at = NOW()
           WHERE id = $1`,
          [order.club_id]
        );
      }
      console.log(`Order ${orderId} marked as refunded and club subscription expired.`);
      return NextResponse.json({ code: 0 });
    }

    if (event === "cancel") {
      // 5. CANCEL EVENT (Payment cancelled/reversed)
      await query(
        `UPDATE subscription_orders
         SET status = 'failed',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );
      if (order.club_id) {
        await query(
          `UPDATE clubs
           SET subscription_status = 'expired',
               subscription_ends_at = NOW()
           WHERE id = $1`,
          [order.club_id]
        );
      }
      console.log(`Order ${orderId} marked as cancelled.`);
      return NextResponse.json({ code: 0 });
    }

    // Default fallback
    return NextResponse.json({ code: 0 });
  } catch (error) {
    console.error("CloudPayments webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
