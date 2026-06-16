const { pool } = require('./src/config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_skillmatch';
const adminId = 'be930cef-0690-406b-a526-64a6625d6713'; // this user is a superadmin in my setup
const token = jwt.sign({ id: adminId }, JWT_SECRET, { expiresIn: '1d' });

async function run() {
  const client = await pool.connect();
  try {
    // Ensure the admin user exists
    let adminRes = await client.query('SELECT id, role FROM users WHERE id = $1', [adminId]);
    if (adminRes.rows.length === 0) {
      // Admin doesn't exist, this shouldn't happen based on previous queries
      return;
    }
    
    // Ensure admin has SUPERADMIN role
    await client.query("UPDATE users SET role = 'superadmin' WHERE id = $1", [adminId]);

    const benRes = await client.query("INSERT INTO users (display_name, phone_number, password_hash) VALUES ('Mock Ben', $1, 'hash') RETURNING id", [Date.now().toString()]);
    const benId = benRes.rows[0].id;
    await client.query("UPDATE wallets SET pending_balance = 5000 WHERE user_id = $1", [benId]);

    const provRes = await client.query("INSERT INTO users (display_name, phone_number, password_hash) VALUES ('Mock Prov', $1, 'hash') RETURNING id", [(Date.now() + 1).toString()]);
    const provId = provRes.rows[0].id;
    // Wallet is already created with 0 balance

    // Create a disputed transaction
    const txRes = await client.query(
      `INSERT INTO transactions (title, initiator_id, provider_id, beneficiary_id, type, amount, status, commission_rate)
       VALUES ('Mock Test Service', $1, $2, $3, 'cash_for_skill', 5000, 'disputed', 0.10) RETURNING id`,
      [benId, provId, benId]
    );
    const txId = txRes.rows[0].id;

    console.log("Mock Disputed Transaction ID:", txId);

    // Call the Admin API to resolve dispute (Provider wins)
    const resolveRes = await fetch(`http://127.0.0.1:3001/api/admin/disputes/${txId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        resolution: 'provider_wins',
        reason: 'Le provider a bien fourni le service selon les preuves.'
      })
    });

    const resolveData = await resolveRes.json();
    console.log("Resolve API Status:", resolveRes.status);
    console.log("Resolve API Response:", JSON.stringify(resolveData, null, 2));

    // Verify wallets
    const benWallet = await client.query("SELECT * FROM wallets WHERE user_id = $1", [benId]);
    const provWallet = await client.query("SELECT * FROM wallets WHERE user_id = $1", [provId]);
    const platfWallet = await client.query("SELECT * FROM platform_account WHERE id = 1");

    console.log("Beneficiary Wallet:", benWallet.rows[0].balance, "Pending:", benWallet.rows[0].pending_balance); // Expected: 0, 0
    console.log("Provider Wallet:", provWallet.rows[0].balance, "Pending:", provWallet.rows[0].pending_balance); // Expected: 4500, 0
    console.log("Platform Account:", platfWallet.rows[0].balance, "Commissions:", platfWallet.rows[0].total_commissions); // Expected: 500, 500

    // Cleanup mock data
    await client.query("DELETE FROM transactions WHERE id = $1", [txId]);
    await client.query("DELETE FROM users WHERE id IN ($1, $2)", [benId, provId]); // cascades to wallets
    // Platform account cleanup is optional, but let's reset it
    await client.query("UPDATE platform_account SET balance = balance - 500, total_commissions = total_commissions - 500 WHERE id = 1");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    pool.end();
  }
}

run();
