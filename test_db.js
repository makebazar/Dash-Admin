const { Client } = require('pg');
async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT id FROM promo_prizes LIMIT 1');
  console.log(typeof res.rows[0].id);
  await client.end();
}
test();
