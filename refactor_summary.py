import re

with open('src/app/api/clubs/[clubId]/salaries/summary/route.ts', 'r') as f:
    code = f.read()

start_marker = "const templateRes = await query("
end_marker = "return NextResponse.json({"

start_idx = code.find(start_marker)
# Find the LAST return NextResponse.json
end_idx = code.rfind(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    exit(1)

get_start_idx = code.find("export async function GET")

before_logic = code[:get_start_idx]
logic = code[start_idx:end_idx]
after_logic = code[end_idx:]

new_code = before_logic + """
export async function getClubSalariesSummary(clubId: string | number, month: number, year: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    
""" + logic + """
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

""" + after_logic

with open('src/app/api/clubs/[clubId]/salaries/summary/route.ts', 'w') as f:
    f.write(new_code)
print("Done!")
