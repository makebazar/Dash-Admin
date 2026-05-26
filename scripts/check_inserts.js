const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx,js,jsx}');

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const regex = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*(?:VALUES\s*\(([^)]+)\)|SELECT\s+(.*?)\s+FROM)/gims;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const table = match[1];
        const cols = match[2].split(',').map(s => s.trim());

        let valsCount = 0;
        let valsStr = '';
        if (match[3]) { // VALUES
            valsStr = match[3];
            // simplistic split by comma, ignoring function calls/nested parens
            valsCount = valsStr.split(',').length;
        } else if (match[4]) { // SELECT
            valsStr = match[4];
            valsCount = valsStr.split(',').length;
        }

        // Just print mismatches if length doesn't match roughly
        if (cols.length !== valsCount) {
             console.log(`Mismatch in ${file}: table ${table}`);
             console.log(`Cols (${cols.length}): ${cols.join(', ')}`);
             console.log(`Vals (${valsCount}): ${valsStr}`);
             console.log('---');
        }
    }
}
