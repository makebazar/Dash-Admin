import { Pool } from 'pg';
import dotenv from 'dotenv';

function normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '')

    // If starts with 8, replace with 7
    if (cleaned.length === 11 && cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.slice(1)
    }

    // If starts with 7 and 11 digits, it's likely already correct
    // If 10 digits, prepend 7
    if (cleaned.length === 10) {
        cleaned = '7' + cleaned
    }

    return cleaned
}

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Starting phone number normalization migration...');

        // 1. Fetch all users
        const usersResult = await client.query('SELECT id, full_name, phone_number, role_id, created_at FROM users');
        const users = usersResult.rows;

        console.log(`Found ${users.length} users.`);

        const phoneMap: Record<string, any[]> = {};

        for (const user of users) {
            const normalized = normalizePhone(user.phone_number);
            if (!phoneMap[normalized]) {
                phoneMap[normalized] = [];
            }
            phoneMap[normalized].push({ ...user, normalized });
        }

        await client.query('BEGIN');

        for (const [phone, records] of Object.entries(phoneMap)) {
            if (records.length === 1) {
                // Just update if format changed
                const record = records[0];
                if (record.phone_number !== phone) {
                    console.log(`Updating ${record.full_name}: ${record.phone_number} -> ${phone}`);
                    await client.query('UPDATE users SET phone_number = $1 WHERE id = $2', [phone, record.id]);
                }
            } else {
                // Handle duplicates
                console.log(`Found duplicates for ${phone}:`, records.map(r => r.phone_number));

                // Sort by role (those with role first) and then by creation date (newest first)
                records.sort((a, b) => {
                    if (a.role_id && !b.role_id) return -1;
                    if (!a.role_id && b.role_id) return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });

                const winner = records[0];
                const losers = records.slice(1);

                console.log(`Winner: ${winner.full_name} (${winner.id}). Losers: ${losers.length}`);

                for (const loser of losers) {
                    // Update references in other tables before deleting
                    // club_employees, schedule_slots, shifts, transactions, verification_codes, etc.

                    console.log(`Merging ${loser.id} into ${winner.id}...`);

                    // Tables with UNIQUE constraints on user_id + other fields
                    const mergeWithUnique = async (table: string, uniqueFields: string[]) => {
                        const fields = uniqueFields.join(', ');
                        const loserRecords = await client.query(`SELECT ${fields} FROM ${table} WHERE user_id = $1`, [loser.id]);
                        for (const row of loserRecords.rows) {
                            const whereClause = uniqueFields.map((f, i) => `${f} = $${i + 2}`).join(' AND ');
                            const values = uniqueFields.map(f => row[f]);
                            const winnerExists = await client.query(`SELECT 1 FROM ${table} WHERE user_id = $1 AND ${whereClause}`, [winner.id, ...values]);
                            if ((winnerExists.rowCount ?? 0) === 0) {
                                await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2 AND ${whereClause}`, [winner.id, loser.id, ...values]);
                            } else {
                                await client.query(`DELETE FROM ${table} WHERE user_id = $1 AND ${whereClause}`, [loser.id, ...values]);
                            }
                        }
                    };

                    await mergeWithUnique('club_employees', ['club_id']);
                    await mergeWithUnique('employee_salary_assignments', ['club_id']);
                    await mergeWithUnique('employee_shift_schedules', ['club_id', 'month', 'year']);
                    await mergeWithUnique('payments', ['club_id', 'month', 'year', 'created_at']);

                    // Simple updates for other tables
                    await client.query('UPDATE schedule_slots SET user_id = $1 WHERE user_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE shifts SET user_id = $1 WHERE user_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE transactions SET created_by_id = $1 WHERE created_by_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE clubs SET owner_id = $1 WHERE owner_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE shift_reports SET opened_by_admin_id = $1 WHERE opened_by_admin_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE shift_reports SET closed_by_admin_id = $1 WHERE closed_by_admin_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE salary_payments SET user_id = $1 WHERE user_id = $2', [winner.id, loser.id]);
                    await client.query('UPDATE salary_payments SET created_by = $1 WHERE created_by = $2', [winner.id, loser.id]);
                    await client.query('UPDATE payments SET created_by = $1 WHERE created_by = $2', [winner.id, loser.id]);

                    await client.query('DELETE FROM users WHERE id = $1', [loser.id]);
                }

                // Update winner's phone number anyway
                await client.query('UPDATE users SET phone_number = $1 WHERE id = $2', [phone, winner.id]);
            }
        }

        // 2. Normalize verification_codes
        console.log('Normalizing verification_codes...');
        const codesResult = await client.query('SELECT id, phone_number FROM verification_codes');
        for (const row of codesResult.rows) {
            const normalized = normalizePhone(row.phone_number);
            if (row.phone_number !== normalized) {
                await client.query('UPDATE verification_codes SET phone_number = $1 WHERE id = $2', [normalized, row.id]);
            }
        }

        await client.query('COMMIT');
        console.log('Migration completed successfully.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
