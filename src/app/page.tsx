import { query } from "@/db";
import LandingClient from "./LandingClient";

// Optionally cache the results, or revalidate dynamically
export const revalidate = 60; // Cache for 60 seconds to reflect DB changes quickly

export default async function Page() {
  const result = await query(
    "SELECT * FROM subscription_plans WHERE is_active = true AND is_public = true ORDER BY display_order ASC;",
  );

  return <LandingClient plans={result.rows} />;
}
