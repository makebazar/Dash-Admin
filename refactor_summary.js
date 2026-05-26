const fs = require('fs');

const summaryPath = 'src/app/api/clubs/[clubId]/salaries/summary/route.ts';
let code = fs.readFileSync(summaryPath, 'utf8');

const getStart = code.indexOf('export async function GET');
const tryStart = code.indexOf('try {', getStart);
const logicStart = code.indexOf('const templateRes = await query(', tryStart);
const logicEnd = code.indexOf('return NextResponse.json({', code.lastIndexOf('filteredSummary'));

if (logicStart === -1 || logicEnd === -1) {
    console.error("Could not find start/end markers");
    process.exit(1);
}

const beforeLogic = code.substring(0, getStart);
const logicContent = code.substring(logicStart, logicEnd);
const afterLogic = code.substring(logicEnd);

const newCode = `${beforeLogic}

export async function getClubSalariesSummary(clubId: string | number, month: number, year: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    ${logicContent}

    return { summary: filteredSummary, leaderboardState, leaderboardTop };
}

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

    const { summary: filteredSummary, leaderboardState, leaderboardTop } = await getClubSalariesSummary(clubId, month, year);

    ${afterLogic}
`;

fs.writeFileSync(summaryPath, newCode);
console.log("Refactored successfully");
