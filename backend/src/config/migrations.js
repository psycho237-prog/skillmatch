const { pool } = require('./database');

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  const client = await pool.connect();
  try {
    // 1. Enable Extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // 2. Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        notification_enabled BOOLEAN DEFAULT true,
        language TEXT DEFAULT 'en',
        theme TEXT DEFAULT 'system',
        push_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 3. Alter users table for added fields
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS correspondent TEXT DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0`);
    
    // Safety check for user role/status (ignoring if constraints already exist or fail on duplicate definition)
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'superadmin'))`);
    } catch (err) {
      // Column might already exist without check constraint, or constraint name matches. Just add column if missing
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`);
    }
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned'))`);
    } catch (err) {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
    }

    // 4. Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        icon TEXT,
        color TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 5. Services table
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        price_type TEXT DEFAULT 'negotiable',
        currency TEXT DEFAULT 'USD',
        barter_skill TEXT,
        location TEXT,
        latitude DECIMAL(10,7),
        longitude DECIMAL(10,7),
        images TEXT[] DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        rating DECIMAL(2,1) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        featured numeric DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 6. Alter services table
    try {
      await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT CHECK (service_type IN ('SKILL_TO_CASH', 'SKILL_TO_SKILL'))`);
    } catch (err) {
      await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT`);
    }
    await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS holdup_amount DECIMAL(10,2)`);
    await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`);
    await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CMR'`);

    // 7. Reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        service_id UUID REFERENCES services(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        content TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 8. Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
        user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
        service_id UUID REFERENCES services(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 9. Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 10. Favorites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        service_id UUID REFERENCES services(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, service_id)
      )
    `);

    // 11. OTP Verifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        phone_number TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        verified BOOLEAN DEFAULT FALSE,
        attempts_count INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ NULL,
        message_id TEXT NULL
      )
    `);

    // 12. Wallets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00 CHECK (balance >= 0),
        pending_balance DECIMAL(15,2) DEFAULT 0.00 CHECK (pending_balance >= 0),
        currency TEXT DEFAULT 'XAF',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 13. Platform Commission Account
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_account (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        balance DECIMAL(15,2) DEFAULT 0.00,
        total_commissions DECIMAL(15,2) DEFAULT 0.00,
        total_transactions INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`INSERT INTO platform_account (id, balance) VALUES (1, 0.00) ON CONFLICT DO NOTHING`);

    // 14. Wallet Transactions table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          type TEXT NOT NULL CHECK (type IN (
            'deposit', 'withdrawal',
            'lock', 'unlock',
            'transfer_in', 'transfer_out',
            'commission', 'refund'
          )),
          amount DECIMAL(15,2) NOT NULL,
          balance_before DECIMAL(15,2) NOT NULL,
          balance_after DECIMAL(15,2) NOT NULL,
          pending_before DECIMAL(15,2) NOT NULL DEFAULT 0,
          pending_after DECIMAL(15,2) NOT NULL DEFAULT 0,
          description TEXT,
          reference_id UUID,
          reference_type TEXT,
          status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (err) {
      // Fallback in case constraint check fails/conflicts on type array
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          type TEXT NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          balance_before DECIMAL(15,2) NOT NULL,
          balance_after DECIMAL(15,2) NOT NULL,
          pending_before DECIMAL(15,2) NOT NULL DEFAULT 0,
          pending_after DECIMAL(15,2) NOT NULL DEFAULT 0,
          description TEXT,
          reference_id UUID,
          reference_type TEXT,
          status TEXT DEFAULT 'completed',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    }

    // 15. Transactions table (for skill matches)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('cash_for_skill', 'skill_for_skill')),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
            'pending', 'accepted', 'in_progress', 'completed',
            'proof_submitted', 'confirmed', 'disputed', 'resolved',
            'auto_validated', 'declined', 'cancelled', 'expired'
          )),
          initiator_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          provider_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          beneficiary_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
          commission_rate DECIMAL(5,4) DEFAULT 0.05,
          commission_amount DECIMAL(15,2),
          currency TEXT DEFAULT 'XAF',
          counterpart_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          counterpart_title TEXT,
          counterpart_description TEXT,
          counterpart_amount DECIMAL(15,2),
          due_date TIMESTAMPTZ,
          confirmation_deadline TIMESTAMPTZ,
          reminder_sent_at TIMESTAMPTZ,
          auto_validate_deadline TIMESTAMPTZ,
          provider_confirmed BOOLEAN DEFAULT FALSE,
          provider_confirmed_at TIMESTAMPTZ,
          beneficiary_confirmed BOOLEAN DEFAULT FALSE,
          beneficiary_confirmed_at TIMESTAMPTZ,
          agreed_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          confirmed_at TIMESTAMPTZ,
          cancelled_at TIMESTAMPTZ,
          dispute_opened_at TIMESTAMPTZ,
          dispute_opened_by UUID REFERENCES users(id) ON DELETE SET NULL,
          dispute_reason TEXT,
          dispute_deadline TIMESTAMPTZ,
          dispute_resolution TEXT,
          dispute_notes TEXT,
          resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
          resolved_at TIMESTAMPTZ,
          proof_submitted_at TIMESTAMPTZ,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (err) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          initiator_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          provider_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          beneficiary_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          amount DECIMAL(15,2) NOT NULL,
          commission_rate DECIMAL(5,4) DEFAULT 0.05,
          commission_amount DECIMAL(15,2),
          currency TEXT DEFAULT 'XAF',
          counterpart_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          counterpart_title TEXT,
          counterpart_description TEXT,
          counterpart_amount DECIMAL(15,2),
          due_date TIMESTAMPTZ,
          confirmation_deadline TIMESTAMPTZ,
          reminder_sent_at TIMESTAMPTZ,
          auto_validate_deadline TIMESTAMPTZ,
          provider_confirmed BOOLEAN DEFAULT FALSE,
          provider_confirmed_at TIMESTAMPTZ,
          beneficiary_confirmed BOOLEAN DEFAULT FALSE,
          beneficiary_confirmed_at TIMESTAMPTZ,
          agreed_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          confirmed_at TIMESTAMPTZ,
          cancelled_at TIMESTAMPTZ,
          dispute_opened_at TIMESTAMPTZ,
          dispute_opened_by UUID REFERENCES users(id) ON DELETE SET NULL,
          dispute_reason TEXT,
          dispute_deadline TIMESTAMPTZ,
          dispute_resolution TEXT,
          dispute_notes TEXT,
          resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
          resolved_at TIMESTAMPTZ,
          proof_submitted_at TIMESTAMPTZ,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    }

    // 16. Transaction Proofs table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS transaction_proofs (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
          submitted_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('delivery', 'dispute', 'counter_dispute')),
          description TEXT,
          files JSONB DEFAULT '[]',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (err) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS transaction_proofs (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
          submitted_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          files JSONB DEFAULT '[]',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    }

    // 17. Escrows table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS escrows (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          type TEXT CHECK (type IN ('SKILL_TO_CASH', 'SKILL_TO_SKILL')),
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          initiator_id UUID REFERENCES users(id) ON DELETE CASCADE,
          counterparty_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount_initiator DECIMAL(10,2) NOT NULL,
          amount_counterparty DECIMAL(10,2) NOT NULL,
          currency VARCHAR(10) NOT NULL,
          platform_fee DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
          status TEXT CHECK (status IN (
            'AWAITING_COUNTERPARTY', 'BOTH_LOCKED', 'PROVIDER_MARKED_DONE',
            'COMPLETED', 'DISPUTED', 'DISPUTE_NO_PROOF', 'FORFEITED',
            'REFUNDED', 'CANCELLED'
          )),
          deposit_id_initiator UUID DEFAULT NULL,
          deposit_id_counterparty UUID DEFAULT NULL,
          provider_confirmed_at TIMESTAMPTZ DEFAULT NULL,
          client_confirmed_at TIMESTAMPTZ DEFAULT NULL,
          dispute_started_at TIMESTAMPTZ DEFAULT NULL,
          dispute_proof_url TEXT DEFAULT NULL,
          auto_resolve_at TIMESTAMPTZ DEFAULT NULL,
          rating_pending BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (err) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS escrows (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          type TEXT,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          initiator_id UUID REFERENCES users(id) ON DELETE CASCADE,
          counterparty_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount_initiator DECIMAL(10,2) NOT NULL,
          amount_counterparty DECIMAL(10,2) NOT NULL,
          currency VARCHAR(10) NOT NULL,
          platform_fee DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
          status TEXT,
          deposit_id_initiator UUID DEFAULT NULL,
          deposit_id_counterparty UUID DEFAULT NULL,
          provider_confirmed_at TIMESTAMPTZ DEFAULT NULL,
          client_confirmed_at TIMESTAMPTZ DEFAULT NULL,
          dispute_started_at TIMESTAMPTZ DEFAULT NULL,
          dispute_proof_url TEXT DEFAULT NULL,
          auto_resolve_at TIMESTAMPTZ DEFAULT NULL,
          rating_pending BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    }

    // Alter escrows for locks
    await client.query(`ALTER TABLE escrows ADD COLUMN IF NOT EXISTS initiator_locked BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE escrows ADD COLUMN IF NOT EXISTS counterparty_locked BOOLEAN DEFAULT FALSE`);

    // 18. Escrow Transactions table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS escrow_transactions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'PAYOUT', 'REFUND', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'FEE', 'ARBITRATION')),
          pawapay_deposit_id TEXT DEFAULT NULL,
          pawapay_payout_id TEXT DEFAULT NULL,
          amount DECIMAL(15,2) NOT NULL,
          currency TEXT DEFAULT 'XAF',
          status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
          escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (err) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS escrow_transactions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          pawapay_deposit_id TEXT DEFAULT NULL,
          pawapay_payout_id TEXT DEFAULT NULL,
          amount DECIMAL(15,2) NOT NULL,
          currency TEXT DEFAULT 'XAF',
          status TEXT DEFAULT 'PENDING',
          escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    }

    // 19. Ratings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
        escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
        score INTEGER CHECK (score >= 1 AND score <= 5),
        comment VARCHAR(300) DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(reviewer_id, escrow_id)
      )
    `);

    // 20. Admin Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        admin_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
        action TEXT NOT NULL,
        target_id UUID,
        target_type TEXT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 21. Create Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_services_category ON services(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews(service_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_id ON wallet_transactions(wallet_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_txns_user_id ON wallet_transactions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_txns_created ON wallet_transactions(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_initiator ON transactions(initiator_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions(provider_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_beneficiary ON transactions(beneficiary_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transaction_proofs_txn ON transaction_proofs(transaction_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone_number)`);

    // 22. Trigger Function and Trigger for auto-wallet creation
    await client.query(`
      CREATE OR REPLACE FUNCTION create_wallet_for_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_create_wallet ON users;
    `);
    await client.query(`
      CREATE TRIGGER trigger_create_wallet
        AFTER INSERT ON users
        FOR EACH ROW EXECUTE FUNCTION create_wallet_for_user();
    `);

    // 23. Insert wallets for any pre-existing users without wallets
    await client.query(`
      INSERT INTO wallets (user_id)
      SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM wallets)
      ON CONFLICT DO NOTHING
    `);

    // 24. Create default superadmin account
    await client.query(`
      INSERT INTO users (phone_number, password_hash, display_name, role, status)
      VALUES (
        '237000000000', 
        crypt('admin123', gen_salt('bf')), 
        'Super Admin', 
        'superadmin', 
        'active'
      )
      ON CONFLICT (phone_number) DO NOTHING
    `);

    console.log('✅ Database migrations executed successfully.');
  } catch (error) {
    console.error('❌ Database migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
