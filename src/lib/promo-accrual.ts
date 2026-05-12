/**
 * Logic for calculating promotional tickets based on purchase amount and club settings.
 */

export type AccrualRule = {
  type: "threshold" | "step";
  amount: number;
  tickets: number;
};

export type PromoSettings = {
  ticket_price?: number;
  accrual_rules?: AccrualRule[];
  bar_accrual_rules?: AccrualRule[];
  welcome_bonus_tickets?: number;
  [key: string]: any;
};

/**
 * Internal logic for calculating tickets given a specific set of rules.
 */
function calculateWithRules(
  amount: number,
  rules: AccrualRule[],
  fallbackTicketPrice?: number,
): number {
  if (amount <= 0) return 0;

  let totalTickets = 0;

  if (rules && rules.length > 0) {
    let bestThresholdTickets = 0;

    for (const rule of rules) {
      if (rule.type === "threshold") {
        if (amount >= rule.amount) {
          bestThresholdTickets = Math.max(bestThresholdTickets, rule.tickets);
        }
      } else if (rule.type === "step") {
        if (rule.amount > 0) {
          totalTickets += Math.floor(amount / rule.amount) * rule.tickets;
        }
      }
    }

    totalTickets += bestThresholdTickets;
  }

  // Fallback to legacy ticket_price if no rules triggered
  if (
    totalTickets === 0 &&
    (!rules || rules.length === 0) &&
    fallbackTicketPrice &&
    fallbackTicketPrice > 0
  ) {
    totalTickets = Math.floor(amount / fallbackTicketPrice);
  }

  return totalTickets;
}

/**
 * Calculates how many tickets should be awarded for a general top-up amount.
 */
export function calculateTicketsForAmount(
  amount: number,
  settings: PromoSettings,
): number {
  return calculateWithRules(
    amount,
    settings.accrual_rules || [],
    settings.ticket_price,
  );
}

/**
 * Calculates how many tickets should be awarded for a POS (bar) purchase amount.
 */
export function calculateTicketsForBarAmount(
  amount: number,
  settings: PromoSettings,
): number {
  // If bar rules exist, use them. Otherwise, fallback to the general rules, then ticket price.
  const rules =
    settings.bar_accrual_rules && settings.bar_accrual_rules.length > 0
      ? settings.bar_accrual_rules
      : settings.accrual_rules || [];
  return calculateWithRules(amount, rules, settings.ticket_price);
}
