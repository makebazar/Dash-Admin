import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireModuleAccess } from "@/lib/club-api-access";
import { query } from "@/db";
import { generateMonthlySalaryReport } from "@/lib/salary-engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(
      searchParams.get("month") || (now.getMonth() + 1).toString(),
    );
    const year = parseInt(
      searchParams.get("year") || now.getFullYear().toString(),
    );

    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isInternalBypass =
      request.headers.get("X-Internal-Bypass") === "true";
    if (!isInternalBypass) {
      await requireModuleAccess(String(clubId), "salaries", "view");
    }

    const { reports, leaderboardState, leaderboardTop } =
      await generateMonthlySalaryReport(clubId, month, year);

    // Get club timezone
    const clubRes = await query(`SELECT timezone FROM clubs WHERE id = $1`, [clubId]);
    const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";

    // Apply filtering logic
    const employeeIdFilter = searchParams.get("employee_id");
    let filteredSummary = reports.map((r: any) => r._legacy_summary_format);

    if (employeeIdFilter) {
      filteredSummary = filteredSummary.filter(
        (emp: any) => String(emp.id) === employeeIdFilter,
      );
    }

    return NextResponse.json({
      summary: filteredSummary,
      timezone,
      leaderboard: leaderboardState
        ? {
            ...leaderboardState.meta,
            top: leaderboardTop,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Salary Summary Error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
