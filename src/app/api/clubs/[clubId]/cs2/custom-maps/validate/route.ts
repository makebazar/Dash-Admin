import { NextResponse } from "next/server";
import { requireClubFullAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);

    const { searchParams } = new URL(request.url);
    const rawInput = searchParams.get("url") || searchParams.get("id") || "";
    const trimmed = rawInput.trim();

    if (!trimmed) {
      return NextResponse.json(
        { error: "Укажите ссылку на карту из Steam Workshop или её ID" },
        { status: 400 }
      );
    }

    // Extract Workshop ID using various formats:
    // - https://steamcommunity.com/sharedfiles/filedetails/?id=3070549948
    // - https://steamcommunity.com/workshop/filedetails/?id=3070549948
    // - id=3070549948
    // - 3070549948
    const idMatch = trimmed.match(/[?&]id=(\d+)/) || trimmed.match(/(\d{6,14})/);
    const workshopId = idMatch ? idMatch[1] : null;

    if (!workshopId) {
      return NextResponse.json(
        { error: "Не удалось обнаружить числовой ID карты в переданной строке" },
        { status: 400 }
      );
    }

    const workshopUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`;

    // Fetch Steam Workshop page
    const steamRes = await fetch(workshopUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      next: { revalidate: 300 },
    });

    if (!steamRes.ok) {
      return NextResponse.json(
        { error: `Steam Workshop вернул ошибку HTTP ${steamRes.status}` },
        { status: 400 }
      );
    }

    const html = await steamRes.text();

    // Check if item exists or is deleted
    const isError =
      html.includes("Steam Community :: Error") ||
      html.includes("There was an error communicating with the network") ||
      html.includes("The item you are looking for does not exist");

    if (isError) {
      return NextResponse.json(
        {
          error:
            "Карта не найдена в мастерской Steam. Возможно, она была удалена автором или скрыта настройками приватности.",
        },
        { status: 404 }
      );
    }

    // Extract Title
    const titleMatch =
      html.match(/<div class="workshopItemTitle">([^<]+)<\/div>/i) ||
      html.match(/<meta property="og:title" content="([^"]+)"/i);
    let title = titleMatch ? titleMatch[1].trim() : `Workshop Map #${workshopId}`;
    title = title.replace(/^Steam Community ::\s*/i, "").trim();

    // Extract Preview Image URL
    const imgMatch =
      html.match(/<meta property="og:image" content="([^"]+)"/i) ||
      html.match(/id="previewImageMain"[^>]*src="([^"]+)"/i) ||
      html.match(/class="workshopItemPreviewImageMain"[^>]*src="([^"]+)"/i);
    let imageUrl = imgMatch ? imgMatch[1].trim() : null;
    if (imageUrl) {
      imageUrl = imageUrl.replace(/&amp;/g, "&");
    }

    // Extract Description
    const descMatch =
      html.match(/<meta property="og:description" content="([^"]+)"/i) ||
      html.match(/<div class="workshopItemDescription"[^>]*>([\s\S]*?)<\/div>/i);
    let description = descMatch ? descMatch[1].trim() : "";
    description = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (description.length > 250) {
      description = description.slice(0, 247) + "...";
    }

    // Check game compatibility (Counter-Strike 2 / appid 730)
    const isCs2 =
      html.includes("Counter-Strike 2") ||
      html.includes("appid=730") ||
      html.includes("/app/730");

    // Guess suggested format from title/description/tags
    let suggestedFormat: "1v1" | "2v2" | "5v5" | "all" = "all";
    const lowerAll = `${title} ${description}`.toLowerCase();
    if (
      lowerAll.includes("aim") ||
      lowerAll.includes("1v1") ||
      lowerAll.includes("1x1") ||
      lowerAll.includes("awp_") ||
      lowerAll.includes("duel")
    ) {
      suggestedFormat = "1v1";
    } else if (
      lowerAll.includes("wingman") ||
      lowerAll.includes("2v2") ||
      lowerAll.includes("2x2") ||
      lowerAll.includes("напарники")
    ) {
      suggestedFormat = "2v2";
    } else if (
      lowerAll.includes("5v5") ||
      lowerAll.includes("5x5") ||
      lowerAll.includes("competitive") ||
      lowerAll.includes("retake")
    ) {
      suggestedFormat = "5v5";
    }

    return NextResponse.json({
      success: true,
      map_id: workshopId,
      name: title,
      description: description || "Карта из мастерской Steam Workshop",
      image_url: imageUrl,
      is_cs2: isCs2,
      workshop_url: workshopUrl,
      suggested_format: suggestedFormat,
    });
  } catch (error: any) {
    console.error("Error validating workshop map:", error);
    return NextResponse.json(
      { error: error?.message || "Не удалось связаться с серверами Steam" },
      { status: 500 }
    );
  }
}
