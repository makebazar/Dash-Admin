const fs = require('fs');
const path = 'src/lib/salary-engine.ts';
let code = fs.readFileSync(path, 'utf8');

// Remove duplicate const/let for hoisted variables
code = code.replace(/const leaderboardState = await getClubEmployeeLeaderboardState/g, 'leaderboardState = await getClubEmployeeLeaderboardState');
code = code.replace(/const leaderboardTop = leaderboard/g, 'leaderboardTop = leaderboard');
code = code.replace(/const filteredSummary = summaryWithLeaderboard/g, 'filteredSummary = summaryWithLeaderboard');

// Type board as any globally in the map
code = code.replace(/const board = leaderboardMap\.get\(employee\.id\);/g, 'const board: any = leaderboardMap.get(employee.id);');

fs.writeFileSync(path, code);
console.log('Fixed final engine');
