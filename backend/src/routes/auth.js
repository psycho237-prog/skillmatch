const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { generateOtpCode, hashOtp, verifyOtpHash } = require('../config/crypto');
const { 
  sendWhatsAppMessage, 
  getLatestQr,
  getConnectionState,
  getLatestPairingCode,
  getPairingNumber,
  requestPairingCode,
  clearAuthInfo
} = require('../config/whatsapp');

// POST /api/auth/send-otp - Send OTP via WhatsApp
router.post('/send-otp', async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const phone = phone_number.replace(/[^\d]/g, '');
    if (!phone) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Rate limiting check (max 3 sends per hour)
    const rateLimitCheck = await query(
      `SELECT count(*) FROM otp_verifications 
       WHERE phone_number = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [phone]
    );
    const count = parseInt(rateLimitCheck.rows[0].count);
    if (count >= 3) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again in an hour.' });
    }

    const code = generateOtpCode();
    const { codeHash, salt } = hashOtp(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    const insertResult = await query(
      `INSERT INTO otp_verifications (phone_number, code_hash, salt, expires_at, verified)
       VALUES ($1, $2, $3, $4, false) RETURNING id`,
      [phone, codeHash, salt, expiresAt]
    );

    const message = `Your Swapster verification code is: ${code}. It expires in 10 minutes. Do not share this code with anyone.`;
    const jid = `${phone}@s.whatsapp.net`;
    let messageId = null;
    let sent = false;

    try {
      messageId = await sendWhatsAppMessage(jid, message);
      sent = true;
      if (messageId) {
        await query(`UPDATE otp_verifications SET message_id=$1 WHERE id=$2`, [
          messageId,
          insertResult.rows[0].id,
        ]);
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
    }

    const allowReturn = process.env.NODE_ENV !== 'production' || process.env.SMS_ALLOW_RETURN_OTP === 'true';
    return res.json({
      ok: true,
      sent,
      debug_otp: allowReturn ? code : undefined,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/register - Register with phone, password, and OTP
router.post('/register', async (req, res) => {
  try {
    const { phone_number, password, display_name, otp_code } = req.body;

    if (!phone_number || !password || !display_name || !otp_code) {
      return res.status(400).json({ error: 'Missing required fields (phone_number, password, display_name, otp_code)' });
    }

    const phone = phone_number.replace(/[^\d]/g, '');

    // Removed 'Phone number already registered' check to allow multiple verifications with same number

    // Verify OTP
    const q = await query(
      `SELECT id, code_hash, salt, expires_at, verified, attempts_count, locked_until
       FROM otp_verifications
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );

    if (q.rowCount === 0) {
      return res.status(400).json({ error: 'No verification code sent to this number' });
    }

    const row = q.rows[0];

    if (row.verified) {
      return res.status(400).json({ error: 'Code already verified' });
    }
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Too many incorrect attempts. Account registration locked.' });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    const ok = verifyOtpHash(otp_code, row.salt, row.code_hash);
    if (!ok) {
      const attempts = row.attempts_count + 1;
      if (attempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lock
        await query(
          `UPDATE otp_verifications SET attempts_count=$1, locked_until=$2 WHERE id=$3`,
          [attempts, lockedUntil, row.id]
        );
      } else {
        await query(`UPDATE otp_verifications SET attempts_count=$1 WHERE id=$2`, [
          attempts,
          row.id,
        ]);
      }
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark verification as complete
    await query(`UPDATE otp_verifications SET verified=true WHERE id=$1`, [row.id]);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert or update user
    const newUser = await query(
      `INSERT INTO users (phone_number, password_hash, display_name, created_at, last_login) 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       ON CONFLICT (phone_number) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name, last_login = NOW()
       RETURNING id, phone_number, display_name, avatar_url, notification_enabled, language, theme`,
      [phone, password_hash, display_name]
    );

    const user = newUser.rows[0];
    const token = generateToken(user);

    res.status(201).json({ user, token, message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login with phone and password
router.post('/login', async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
      return res.status(400).json({ error: 'Missing phone_number or password' });
    }

    const phone = phone_number.replace(/[^\d]/g, '');
    const result = await query('SELECT * FROM users WHERE phone_number = $1', [phone]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Update last login
    const updatedUserRes = await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING id, phone_number, display_name, avatar_url, notification_enabled, language, theme',
      [user.id]
    );

    const updatedUser = updatedUserRes.rows[0];
    const token = generateToken(updatedUser);

    res.json({ user: updatedUser, token, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/user/:id - Get user by ID
router.get('/user/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, phone_number, display_name, avatar_url, notification_enabled, language, theme, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/auth/status - Return connection, QR, and pairing code status
router.get('/status', (req, res) => {
  const currentStatus = getConnectionState();
  const pairingCode = getLatestPairingCode();
  
  let status = currentStatus;
  if ((currentStatus === 'qr' || currentStatus === 'connecting' || currentStatus === 'disconnected') && pairingCode) {
    status = 'pairing';
  }

  res.json({
    connected: currentStatus === 'connected',
    status: status,
    qr: getLatestQr(),
    pairingCode: pairingCode,
    pairingNumber: getPairingNumber(),
  });
});

// POST /api/auth/request-pairing - Request a pairing code dynamically
router.post('/request-pairing', async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    const phone = phone_number.replace(/[^\d]/g, '');
    if (!phone) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    const code = await requestPairingCode(phone);
    return res.json({ ok: true, code });
  } catch (error) {
    console.error('Request pairing error:', error);
    return res.status(500).json({ error: error.message || 'Failed to request pairing code' });
  }
});

// GET /api/auth/qr - Return the latest WhatsApp QR code as JSON
router.get('/qr', (req, res) => {
  res.json({ qr: getLatestQr() });
});

// GET /api/auth/qr-page - Render a clean, premium dashboard for WhatsApp link
router.get('/qr-page', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Swapster OTP Gateway</title>
      <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
      <style>
        :root {
          --bg-color: #0b141a;
          --card-bg: #111b21;
          --primary: #00a884;
          --primary-hover: #008f72;
          --text: #e9edef;
          --text-muted: #8696a0;
          --border: #222d34;
          --card-inner: #182229;
          --danger: #ea0038;
          --warning: #e0a900;
          --info: #009cf0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: var(--bg-color);
          color: var(--text);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .dashboard {
          background-color: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 520px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
          text-align: center;
        }
        .header {
          margin-bottom: 30px;
        }
        h1 {
          color: var(--primary);
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .desc {
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.5;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 24px;
          background-color: var(--card-inner);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }
        .status-connected { color: var(--primary); }
        .status-connected .status-dot { background-color: var(--primary); box-shadow: 0 0 10px var(--primary); }
        .status-qr { color: var(--info); }
        .status-qr .status-dot { background-color: var(--info); box-shadow: 0 0 10px var(--info); }
        .status-pairing { color: var(--warning); }
        .status-pairing .status-dot { background-color: var(--warning); box-shadow: 0 0 10px var(--warning); }
        .status-connecting { color: var(--warning); }
        .status-connecting .status-dot { background-color: var(--warning); animation: pulse 1.5s infinite; }
        .status-disconnected { color: var(--danger); }
        .status-disconnected .status-dot { background-color: var(--danger); box-shadow: 0 0 10px var(--danger); }
        
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }

        .main-section {
          background-color: var(--card-inner);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 30px 20px;
          margin-bottom: 24px;
          min-height: 240px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          transition: all 0.3s ease;
        }
        
        #qrcode {
          background: white;
          padding: 16px;
          border-radius: 16px;
          display: inline-block;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        #qrcode img {
          display: block;
        }

        .pairing-code-display {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 6px;
          font-family: monospace;
          color: var(--primary);
          background: var(--card-bg);
          border: 1px dashed var(--border);
          padding: 15px 25px;
          border-radius: 12px;
          margin: 15px 0;
          user-select: all;
        }

        .tabs {
          display: flex;
          background: var(--card-inner);
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid var(--border);
        }
        .tab {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: transparent;
        }
        .tab.active {
          background: var(--card-bg);
          color: var(--primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .form-group {
          width: 100%;
          text-align: left;
          margin-bottom: 16px;
        }
        label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        input {
          flex: 1;
          background-color: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 15px;
          color: var(--text);
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus {
          border-color: var(--primary);
        }
        .btn {
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px 24px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
          width: 100%;
        }
        .btn:hover {
          background-color: var(--primary-hover);
        }
        .btn:disabled {
          background-color: var(--border);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .status-text {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .alert {
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
          margin-top: 15px;
          text-align: left;
          display: none;
        }
        .alert-error {
          background-color: rgba(234, 0, 56, 0.1);
          color: #ff4d6d;
          border: 1px solid rgba(234, 0, 56, 0.2);
        }
        .alert-success {
          background-color: rgba(0, 168, 132, 0.1);
          color: #2ec4b6;
          border: 1px solid rgba(0, 168, 132, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="header">
          <h1>Swapster OTP Gateway</h1>
          <p class="desc">Connect the server to WhatsApp to enable automated OTP verification messages.</p>
        </div>

        <div class="status-badge status-disconnected" id="statusBadge">
          <span class="status-dot"></span>
          <span id="statusText">Checking Connection...</span>
        </div>

        <div class="tabs" id="authTabs">
          <button class="tab active" onclick="switchMode('qr')">QR Code</button>
          <button class="tab" onclick="switchMode('pair')">Pairing Code</button>
        </div>

        <div class="main-section">
          <!-- QR Panel -->
          <div id="qrPanel" style="width: 100%;">
            <div id="qrcode">Generating QR...</div>
            <div class="status-text" style="margin-top: 16px;" id="qrInstruction">Scan this QR code with WhatsApp on your phone (Linked Devices).</div>
          </div>

          <!-- Pairing Panel -->
          <div id="pairPanel" style="display: none; width: 100%;">
            <div class="form-group" id="pairingForm">
              <label for="phoneNumber">WhatsApp Number (with country code)</label>
              <div style="display: flex; gap: 10px;">
                <input type="text" id="phoneNumber" placeholder="e.g. 237696814391" value="">
                <button class="btn" style="width: auto;" id="requestPairBtn" onclick="requestPairing()">Request Code</button>
              </div>
            </div>
            <div id="pairingCodeContainer" style="display: none;">
              <div class="status-text">Enter this code on your phone when prompted:</div>
              <div class="pairing-code-display" id="pairingCodeDisplay">---- - ----</div>
              <div class="status-text" id="pairingNumberDisplay">Requesting pairing for...</div>
              <button class="btn" style="margin-top: 15px; background-color: var(--card-bg); border: 1px solid var(--border); color: var(--text-muted);" onclick="resetPairingView()">Back to Request</button>
            </div>
          </div>

          <!-- Success Panel -->
          <div id="successPanel" style="display: none;">
            <div style="font-size: 64px; margin-bottom: 12px;">✅</div>
            <h3 style="color: var(--primary); font-size: 20px; margin-bottom: 8px;">Successfully Connected!</h3>
            <p class="desc" style="margin-bottom: 15px;">The WhatsApp OTP gateway is live and ready to transmit verification codes.</p>
            <div class="status-text">Connected Device Info is saved in credentials.</div>
          </div>
        </div>

        <div class="alert alert-error" id="errorAlert"></div>
        <div class="alert alert-success" id="successAlert"></div>
      </div>

      <script>
        let currentMode = 'qr';
        let currentQr = null;
        let currentPairingCode = null;
        let isRequesting = false;

        function switchMode(mode) {
          if (mode === currentMode) return;
          currentMode = mode;
          
          const tabs = document.querySelectorAll('.tab');
          tabs[0].classList.toggle('active', mode === 'qr');
          tabs[1].classList.toggle('active', mode === 'pair');

          document.getElementById('qrPanel').style.display = mode === 'qr' ? 'block' : 'none';
          document.getElementById('pairPanel').style.display = mode === 'pair' ? 'block' : 'none';
          
          hideAlerts();
        }

        function showAlert(type, message) {
          const alert = document.getElementById(type === 'error' ? 'errorAlert' : 'successAlert');
          alert.innerText = message;
          alert.style.display = 'block';
          setTimeout(() => alert.style.display = 'none', 6000);
        }

        function hideAlerts() {
          document.getElementById('errorAlert').style.display = 'none';
          document.getElementById('successAlert').style.display = 'none';
        }

        async function requestPairing() {
          const phoneInput = document.getElementById('phoneNumber');
          const phoneNumber = phoneInput.value.trim();
          if (!phoneNumber) {
            showAlert('error', 'Please enter a valid phone number.');
            return;
          }

          const btn = document.getElementById('requestPairBtn');
          btn.disabled = true;
          btn.innerText = 'Requesting...';
          hideAlerts();

          try {
            const res = await fetch('/api/auth/request-pairing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone_number: phoneNumber })
            });
            const data = await res.json();
            
            if (data.ok && data.code) {
              const rawCode = data.code;
              const formatted = rawCode.length === 8 ? rawCode.slice(0, 4) + ' - ' + rawCode.slice(4) : rawCode;
              
              document.getElementById('pairingCodeDisplay').innerText = formatted;
              document.getElementById('pairingNumberDisplay').innerText = 'Enter code on device +' + phoneNumber.replace(/[^\\d]/g, '');
              document.getElementById('pairingForm').style.display = 'none';
              document.getElementById('pairingCodeContainer').style.display = 'block';
              showAlert('success', 'Pairing code generated successfully!');
            } else {
              showAlert('error', data.error || 'Failed to request pairing code.');
            }
          } catch (err) {
            console.error(err);
            showAlert('error', 'Error contacting server. Retrying...');
          } finally {
            btn.disabled = false;
            btn.innerText = 'Request Code';
          }
        }

        function resetPairingView() {
          document.getElementById('pairingForm').style.display = 'block';
          document.getElementById('pairingCodeContainer').style.display = 'none';
          document.getElementById('pairingCodeDisplay').innerText = '---- - ----';
          hideAlerts();
        }

        async function updateStatus() {
          try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();
            
            const badge = document.getElementById('statusBadge');
            const label = document.getElementById('statusText');
            
            badge.className = 'status-badge status-' + data.status;
            
            if (data.status === 'connected') {
              label.innerText = 'Connected';
              document.getElementById('authTabs').style.display = 'none';
              document.getElementById('qrPanel').style.display = 'none';
              document.getElementById('pairPanel').style.display = 'none';
              document.getElementById('successPanel').style.display = 'block';
            } else {
              document.getElementById('authTabs').style.display = 'flex';
              document.getElementById('successPanel').style.display = 'none';
              
              if (currentMode === 'qr') {
                document.getElementById('qrPanel').style.display = 'block';
              } else {
                document.getElementById('pairPanel').style.display = 'block';
              }

              if (data.status === 'connecting') {
                label.innerText = 'Connecting...';
                document.getElementById('qrcode').innerText = 'Connecting to WhatsApp...';
              } else if (data.status === 'disconnected') {
                label.innerText = 'Disconnected';
                document.getElementById('qrcode').innerText = 'Please refresh or check logs.';
              } else if (data.status === 'qr') {
                label.innerText = 'Scan QR Code';
                if (data.qr && currentQr !== data.qr) {
                  currentQr = data.qr;
                  const qrContainer = document.getElementById('qrcode');
                  qrContainer.innerHTML = '';
                  const qr = qrcode(0, 'H');
                  qr.addData(data.qr);
                  qr.make();
                  qrContainer.innerHTML = qr.createImgTag(6);
                }
              } else if (data.status === 'pairing') {
                label.innerText = 'Pairing Code Active';
                
                if (data.pairingCode && currentPairingCode !== data.pairingCode) {
                  currentPairingCode = data.pairingCode;
                  const formatted = data.pairingCode.length === 8 
                    ? data.pairingCode.slice(0, 4) + ' - ' + data.pairingCode.slice(4) 
                    : data.pairingCode;
                  
                  document.getElementById('pairingCodeDisplay').innerText = formatted;
                  document.getElementById('pairingNumberDisplay').innerText = 'Enter code on device +' + data.pairingNumber;
                  document.getElementById('pairingForm').style.display = 'none';
                  document.getElementById('pairingCodeContainer').style.display = 'block';
                  switchMode('pair');
                }
              }
            }
          } catch (err) {
            console.error('Failed to poll status:', err);
          }
        }

        updateStatus();
        setInterval(updateStatus, 3000);
      </script>
    </body>
    </html>
  `);
});

module.exports = router;
