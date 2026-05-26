const fs = require('fs');

const path = 'src/lib/salary-engine.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace `const leaderboardState = ` with `leaderboardState = `
// Replace `const leaderboardTop = ` with `leaderboardTop = `
code = code.replace(/const leaderboardState = await getClubEmployeeLeaderboardState/g, 'leaderboardState = await getClubEmployeeLeaderboardState');
code = code.replace(/const leaderboardTop = leaderboard\.slice/g, 'leaderboardTop = leaderboard.slice');
code = code.replace(/const filteredSummary = summaryWithLeaderboard/g, 'filteredSummary = summaryWithLeaderboard');

// Now, hoist the declarations to just above `const hasAnyLeaderboardBonusConfig`
const hoistTarget = 'const hasAnyLeaderboardBonusConfig = summary.some(';
const hoistDeclarations = `let leaderboardState: any = { meta: { is_frozen: false, finalized_at: null }, leaderboard: [] };
    let leaderboardTop: any[] = [];
    let filteredSummary: any[] = [];

    `;

code = code.replace(hoistTarget, hoistDeclarations + hoistTarget);

fs.writeFileSync(path, code);
console.log('Fixed variable hoisting in salary-engine.ts');
