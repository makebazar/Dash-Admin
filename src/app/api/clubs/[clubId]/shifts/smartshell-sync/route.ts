import { NextResponse } from "next/server";
import { syncSmartShellShifts } from "@/lib/smartshell/shift-sync";
import { requireModuleAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "shifts", "view");

    const result = await syncSmartShellShifts(clubId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("SmartShell Shift Sync Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "shifts", "edit");

    const result = await syncSmartShellShifts(clubId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("SmartShell Shift Sync POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
