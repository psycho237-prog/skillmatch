-- SkillPay escrow system migrations

-- 1. Create check constraints or alter tables
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT CHECK (service_type IN ('SKILL_TO_CASH', 'SKILL_TO_SKILL'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS holdup_amount DECIMAL(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS correspondent TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- 3. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  currency VARCHAR(10) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('DEPOSIT', 'PAYOUT', 'REFUND', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'FEE', 'ARBITRATION')),
  pawapay_deposit_id TEXT DEFAULT NULL,
  pawapay_payout_id TEXT DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status TEXT CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Escrow Table
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
    'AWAITING_COUNTERPARTY',
    'BOTH_LOCKED',
    'PROVIDER_MARKED_DONE',
    'COMPLETED',
    'DISPUTED',
    'DISPUTE_NO_PROOF',
    'FORFEITED',
    'REFUNDED',
    'CANCELLED'
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
);

-- 6. Ratings Table
CREATE TABLE IF NOT EXISTS ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  comment VARCHAR(300) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reviewer_id, escrow_id)
);

-- 7. Add otp_verifications table if missing (to match local_schema.sql)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  attempts_count INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  message_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone_number);
