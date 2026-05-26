const fs = require('fs');

const summaryPath = 'src/app/api/clubs/[clubId]/salaries/summary/route.ts';
let code = fs.readFileSync(summaryPath, 'utf8');

const coreLogicStart = code.indexOf('const startOfMonth = new Date(year, month - 1, 1);');
const coreLogicEnd = code.indexOf('const employeeIdFilter = searchParams.get("employee_id");');

if (coreLogicStart === -1 || coreLogicEnd === -1) {
  console.error("Could not find start/end markers");
  process.exit(1);
}

let coreLogic = code.substring(coreLogicStart, coreLogicEnd);

const libCode = `import { query } from "@/db";
import { calculateSalary } from "@/lib/salary-calculator";
import { calculateMaintenanceOverduePenalty } from "@/lib/maintenance-penalties";
import { calculateMaintenanceQualityMetrics } from "@/lib/maintenance-kpi-quality";

export async function getClubSalariesSummary(clubId: string, month: number, year: number) {
  ${coreLogic}

  return { summary };
}
`;

fs.writeFileSync('src/lib/salary-summary.ts', libCode);

const newSummaryCode = `import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireModuleAccess } from "@/lib/club-api-access";
import { getClubSalariesSummary } from "@/lib/salary-summary";
import { getClubEmployeeLeaderboardState } from "@/lib/employee-leaderboard";

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

    await requireModuleAccess(String(clubId), "salaries", "view");

    const { summary } = await getClubSalariesSummary(String(clubId), month, year);

    ${code.substring(coreLogicEnd)}
`;

fs.writeFileSync(summaryPath, newSummaryCode);
console.log("Done");
