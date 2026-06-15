-- ============================================================
-- SWAPSTER — Admin System Migration
-- Run: sudo -u postgres psql -d skillmatch -f /tmp/admin_schema.sql
-- ============================================================

-- Add role and status to users if they don't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'superadmin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status') THEN
    ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

-- Admin Activity Logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  action TEXT NOT NULL,
  target_id UUID, -- user_id, transaction_id, wallet_id, etc.
  target_type TEXT, -- 'user', 'transaction', 'wallet', 'dispute'
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for admin logs
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- Promote the first user to superadmin for testing
UPDATE users SET role = 'superadmin' WHERE email = 'demo1@example.com';

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE admin_logs TO skillmatch_user;
