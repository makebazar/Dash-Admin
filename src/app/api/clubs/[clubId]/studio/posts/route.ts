import { NextResponse } from "next/server";
import { requireClubApiAccess, requireClubFullAccess } from "@/lib/club-api-access";
import { getClubPosts, saveClubPost, deleteClubPost } from "@/lib/studio-brand";

export async function GET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubApiAccess(clubId);
    const posts = await getClubPosts(clubId);
    return NextResponse.json({ posts });
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
    if (!body?.title || !body?.template_id) {
      return NextResponse.json({ error: "Название и шаблон обязательны" }, { status: 400 });
    }
    const saved = await saveClubPost(clubId, {
      id: body.id,
      title: body.title,
      template_id: body.template_id,
      format: body.format || "post",
      data: body.data || {},
      preview_url: body.preview_url,
    });
    return NextResponse.json({ post: saved });
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
    const postId = searchParams.get("id");
    if (!postId) return NextResponse.json({ error: "ID поста обязателен" }, { status: 400 });
    await deleteClubPost(clubId, postId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}
