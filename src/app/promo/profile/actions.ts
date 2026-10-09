"use server";

import { getClient } from "@/db";
import { cookies } from "next/headers";

import { resolveSteamId64 } from "@/lib/steam-resolver";

export async function updatePlayerLinks(formData: FormData) {
  const cookieStore = await cookies();
  const playerId = cookieStore.get("promo_player_id")?.value;

  if (!playerId) {
    return { error: "Unauthorized" };
  }

  let steamLink = formData.get("steam_link")?.toString() || "";
  let faceitLink = formData.get("faceit_link")?.toString() || "";

  let steamId = await resolveSteamId64(steamLink);

  const client = await getClient();
  try {
    await client.query(
      `UPDATE promo_players SET steam_link = $1, steam_id = $2, faceit_link = $3 WHERE id = $4`,
      [steamLink, steamId, faceitLink, playerId]
    );

    return { success: true, steam_id: steamId };
  } catch (e: any) {
    return { error: e.message };
  }
}
