const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  console.log("=== EMPLOYEE SALARY ASSIGNMENTS ===");
  const assignmentsRes = await client.query(`
    SELECT a.user_id, u.full_name as employee_name, a.scheme_id, s.name as scheme_name
    FROM employee_salary_assignments a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN salary_schemes s ON a.scheme_id = s.id
    WHERE a.club_id = 1
  `);
  console.log(JSON.stringify(assignmentsRes.rows, null, 2));

  console.log("\n=== RECENT SHIFTS WITH SALARY BREAKDOWN ===");
  const shiftsRes = await client.query(`
    SELECT s.id, s.user_id, u.full_name as employee_name, s.check_in, s.check_out, s.salary_calculated, s.salary_breakdown
    FROM shifts s
    JOIN users u ON s.user_id = u.id
    WHERE s.club_id = 1
    ORDER BY s.check_in DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(shiftsRes.rows, null, 2));
  
  await client.end();
}

run().catch(console.error);
