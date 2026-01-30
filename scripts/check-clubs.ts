import { query } from '../src/db';

async function checkClubs() {
    try {
        const res = await query('SELECT id, name FROM clubs');
        console.table(res.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkClubs();
