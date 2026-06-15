-- ============================================================
-- SWAPSTER — Transaction System Migration
-- Run: sudo -u postgres psql -d skillmatch -f /tmp/transactions_schema.sql
-- ============================================================

-- Wallets (one per user, auto-created on registration)
CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00 CHECK (balance >= 0),
  pending_balance DECIMAL(15,2) DEFAULT 0.00 CHECK (pending_balance >= 0),
  currency TEXT DEFAULT 'XAF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform commission account (singleton)
CREATE TABLE IF NOT EXISTS platform_account (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  balance DECIMAL(15,2) DEFAULT 0.00,
  total_commissions DECIMAL(15,2) DEFAULT 0.00,
  total_transactions INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO platform_account (id, balance) VALUES (1, 0.00) ON CONFLICT DO NOTHING;

-- Wallet transaction history (full audit trail)
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
  reference_id UUID, -- transaction ID or external ref
  reference_type TEXT, -- 'transaction', 'mobile_money', 'dispute'
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('cash_for_skill', 'skill_for_skill')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',         -- created, waiting for acceptance
    'accepted',        -- accepted, funds locked
    'in_progress',     -- work in progress
    'completed',       -- provider marked done
    'proof_submitted', -- buyer submitted delivery proof (C4S)
    'confirmed',       -- confirmed by all parties → funds released
    'disputed',        -- dispute opened
    'resolved',        -- dispute resolved by admin
    'auto_validated',  -- auto-validated after deadline
    'declined',        -- rejected by other party
    'cancelled',       -- cancelled before acceptance
    'expired'          -- expired without action
  )),

  -- Parties
  initiator_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  provider_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  beneficiary_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,

  -- Service info
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Financial
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  commission_rate DECIMAL(5,4) DEFAULT 0.05,
  commission_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'XAF',

  -- Skill-for-Skill counterpart
  counterpart_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  counterpart_title TEXT,
  counterpart_description TEXT,
  counterpart_amount DECIMAL(15,2), -- value of the exchange service

  -- Deadlines
  due_date TIMESTAMPTZ,
  confirmation_deadline TIMESTAMPTZ, -- 5 days (C4S) or 7 days (S4S) after completed_at
  reminder_sent_at TIMESTAMPTZ,
  auto_validate_deadline TIMESTAMPTZ, -- +48h after reminder

  -- Confirmation tracking (S4S: both must confirm)
  provider_confirmed BOOLEAN DEFAULT FALSE,
  provider_confirmed_at TIMESTAMPTZ,
  beneficiary_confirmed BOOLEAN DEFAULT FALSE,
  beneficiary_confirmed_at TIMESTAMPTZ,

  -- Timestamps
  agreed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Dispute
  dispute_opened_at TIMESTAMPTZ,
  dispute_opened_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dispute_reason TEXT,
  dispute_deadline TIMESTAMPTZ, -- 72h from dispute open
  dispute_resolution TEXT, -- 'provider_wins', 'beneficiary_wins', 'split', 'auto_refund'
  dispute_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  -- Proof of delivery (C4S)
  proof_submitted_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proof files (for delivery confirmation and disputes)
CREATE TABLE IF NOT EXISTS transaction_proofs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('delivery', 'dispute', 'counter_dispute')),
  description TEXT,
  files JSONB DEFAULT '[]', -- array of {url, name, type}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_initiator ON transactions(initiator_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_transactions_beneficiary ON transactions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_proofs_txn ON transaction_proofs(transaction_id);

-- Auto-create wallet when user is created
CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_wallet ON users;
CREATE TRIGGER trigger_create_wallet
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_wallet_for_user();

-- Create wallets for existing users
INSERT INTO wallets (user_id)
SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM wallets)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE wallets TO skillmatch_user;
GRANT ALL PRIVILEGES ON TABLE wallet_transactions TO skillmatch_user;
GRANT ALL PRIVILEGES ON TABLE platform_account TO skillmatch_user;
GRANT ALL PRIVILEGES ON TABLE transactions TO skillmatch_user;
GRANT ALL PRIVILEGES ON TABLE transaction_proofs TO skillmatch_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO skillmatch_user;
