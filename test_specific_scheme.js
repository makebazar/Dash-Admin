const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log("=== ALL SCHEMES (BRIEF SUMMARY) ===");
  const schemesRes = await client.query(`
    SELECT id, name, club_id, is_active 
    FROM salary_schemes
  `);
  console.log(JSON.stringify(schemesRes.rows, null, 2));

  console.log("\n=== DETAILED MATCHING SCHEMES (тест, test, шаблон) ===");
  for (const scheme of schemesRes.rows) {
    const isTarget = scheme.name.toLowerCase().includes('тест') || 
                     scheme.name.toLowerCase().includes('test') || 
                     scheme.name.toLowerCase().includes('шаблон');
    
    if (isTarget) {
      console.log(`\n==========================================`);
      console.log(`FOUND: "${scheme.name}" (ID: ${scheme.id}, Club: ${scheme.club_id}, Active: ${scheme.is_active})`);
      console.log(`==========================================`);
      
      const versionsRes = await client.query(`
        SELECT version, formula, created_at 
        FROM salary_scheme_versions 
        WHERE scheme_id = $1
        ORDER BY version DESC
      `, [scheme.id]);
      
      console.log(`Total Versions: ${versionsRes.rows.length}`);
      if (versionsRes.rows.length > 0) {
        // print only the latest version in full detail to save space
        const latest = versionsRes.rows[0];
        console.log(`\n--- LATEST VERSION ${latest.version} (Created at: ${latest.created_at}) ---`);
        console.log(JSON.stringify(latest.formula, null, 2));
        
        if (versionsRes.rows.length > 1) {
          console.log("\n--- PREVIOUS VERSIONS SUMMARY ---");
          for (let i = 1; i < versionsRes.rows.length; i++) {
            console.log(`Version ${versionsRes.rows[i].version} created at ${versionsRes.rows[i].created_at}`);
          }
        }
      }
    }
  }

  console.log("\n=== ASSIGNMENTS TO TARGET SCHEMES ===");
  const assignmentsRes = await client.query(`
    SELECT a.user_id, u.full_name as employee_name, a.scheme_id, s.name as scheme_name, a.club_id
    FROM employee_salary_assignments a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN salary_schemes s ON a.scheme_id = s.id
    WHERE s.name ILIKE '%тест%' OR s.name ILIKE '%test%' OR s.name ILIKE '%шаблон%'
  `);
  console.log(JSON.stringify(assignmentsRes.rows, null, 2));
  
  await client.end();
}

run().catch(console.error);
