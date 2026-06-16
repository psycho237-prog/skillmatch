const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_skillmatch';
const userId = 'be930cef-0690-406b-a526-64a6625d6713';
const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1d' });

async function testDeposit() {
  console.log("Token:", token);
  try {
    const res = await fetch('http://127.0.0.1:3001/api/wallet/deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 500,
        mobile_money_number: '237653456789'
      })
    });
    const data = await res.json();
    console.log("Deposit Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testDeposit();
