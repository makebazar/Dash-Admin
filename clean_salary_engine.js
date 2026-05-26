const fs = require('fs');

const path = 'src/lib/salary-engine.ts';
let code = fs.readFileSync(path, 'utf8');

// Remove the HTTP response block and module access check
const unauthorizedCheck = `    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isInternalBypass =
      request.headers.get("X-Internal-Bypass") === "true";
    if (!isInternalBypass) {
      await requireModuleAccess(String(clubId), "salaries", "view");
    }`;

code = code.replace(unauthorizedCheck, '');

// Also at the end of the core logic, there's a try-catch block wrapping it that ends with:
/*
    const filteredSummary = summaryWithLeaderboard.filter(
      (emp) =>
        emp.shifts_count > 0 || emp.total_accrued !== 0 || emp.total_paid !== 0,
    );

    return NextResponse.json({
      summary: filteredSummary,
      leaderboard: {
        ...leaderboardState.meta,
        top: leaderboardTop,
      },
    });
  } catch (error: any) {
    console.error("Salary Summary Error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
*/
// The script that generated `salary-engine.ts` stopped right before `return NextResponse.json({`.
// Let's ensure there are no leftover `NextResponse` or `try/catch` braces at the end of `coreLogic`.
// Wait, the start string was `const startOfMonth = ...`. So there is no `try {` block copied because `try {` is above it in `route.ts`.
// What about the end string? `const endIdx = code.lastIndexOf("return NextResponse.json({");`
// So `coreLogic` ended there. `filteredSummary` is available.

// Let's replace any lingering `NextResponse` or `request` just in case
code = code.replace(/request\.headers/g, '/* removed request.headers */');
code = code.replace(/NextResponse\.json/g, '/* removed NextResponse */');
code = code.replace(/userId/g, '/* removed userId */');

// Wait, if `userId` is used elsewhere in `summary/route.ts`, replacing all `userId` will break variable names like `user_id`.
// Let's revert and do a safer replacement.

code = fs.readFileSync(path, 'utf8');
code = code.replace(
`    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isInternalBypass =
      request.headers.get("X-Internal-Bypass") === "true";
    if (!isInternalBypass) {
      await requireModuleAccess(String(clubId), "salaries", "view");
    }`,
  ''
);

// We need to type the board argument correctly to prevent TS errors.
// Change `board?.rank` to `(board as any)?.rank` etc.
code = code.replace(/board\?\./g, '(board as any)?.');
code = code.replace(/board\./g, '(board as any).');

fs.writeFileSync(path, code);
console.log('Cleaned up salary-engine.ts');
