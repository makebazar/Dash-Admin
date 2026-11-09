import { NextResponse } from "next/server";
import { requireClubApiAccess, requireClubFullAccess } from "@/lib/club-api-access";
import { getClubAssets, saveClubAsset, deleteClubAsset } from "@/lib/studio-brand";

export async function GET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubApiAccess(clubId);
    const assets = await getClubAssets(clubId);
    return NextResponse.json({ assets });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);
    const body = await request.json();
    if (!body?.url || !body?.name) {
      return NextResponse.json({ error: "URL и имя ассета обязательны" }, { status: 400 });
    }
    const asset = await saveClubAsset(clubId, {
      type: body.type || "photo",
      name: body.name,
      url: body.url,
    });
    return NextResponse.json({ asset });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("id");
    if (!assetId) return NextResponse.json({ error: "ID ассета обязателен" }, { status: 400 });
    await deleteClubAsset(clubId, assetId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}
