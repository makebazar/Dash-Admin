import { query } from './src/db/index.js';

async function debug() {
    try {
        const clubId = process.argv[2];
        if (!clubId) {
            console.log('Usage: node debug-sync.js <clubId>');
            return;
        }

        console.log(`--- Debugging sync for Club ID: ${clubId} ---`);

        // 1. Check Accounts
        const accounts = await query('SELECT id, name, account_type, current_balance FROM finance_accounts WHERE club_id = $1', [clubId]);
        console.log('\nAccounts:');
        console.table(accounts.rows);

        // 2. Check Transactions count and linked accounts
        const txStats = await query(`
      SELECT 
        payment_method, 
        COUNT(*) as total,
        COUNT(account_id) as linked,
        SUM(amount) as total_amount
      FROM finance_transactions 
      WHERE club_id = $1 AND status = 'completed'
      GROUP BY payment_method
    `, [clubId]);
        console.log('\nTransaction Stats:');
        console.table(txStats.rows);

        // 3. Check for specific income fields in active template
        const template = await query(`
      SELECT schema FROM club_report_templates 
      WHERE club_id = $1 AND is_active = true 
      ORDER BY created_at DESC LIMIT 1
    `, [clubId]);

        if (template.rows.length > 0) {
            console.log('\nActive Template Income Fields:');
            const incomeFields = template.rows[0].schema.filter(f => f.field_type === 'INCOME');
            console.table(incomeFields.map(f => ({
                metric_key: f.metric_key,
                custom_label: f.custom_label,
                account_id: f.account_id
            })));
        } else {
            console.log('\nNo active template found.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debug();
