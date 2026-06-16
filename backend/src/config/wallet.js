const { query, pool } = require('./database');

/**
 * Log a wallet transaction history entry
 */
const logWalletTransaction = async (client, walletId, userId, type, amount, balanceBefore, balanceAfter, pendingBefore, pendingAfter, description, refId, refType, status = 'completed') => {
  await client.query(
    `INSERT INTO wallet_transactions 
    (wallet_id, user_id, type, amount, balance_before, balance_after, pending_before, pending_after, description, reference_id, reference_type, status) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [walletId, userId, type, amount, balanceBefore, balanceAfter, pendingBefore, pendingAfter, description, refId, refType, status]
  );
};

/**
 * Process a deposit into the user's wallet
 */
const processDeposit = async (userId, amount, refId = null, description = 'Mobile Money Deposit') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get wallet with row lock
    const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    if (walletRes.rows.length === 0) throw new Error('Wallet not found');
    const wallet = walletRes.rows[0];
    
    const amountNum = parseFloat(amount);
    const newBalance = parseFloat(wallet.balance) + amountNum;
    
    // Update balance
    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.id]);
    
    // Log transaction
    await logWalletTransaction(
      client, wallet.id, userId, 'deposit', amountNum, 
      wallet.balance, newBalance, wallet.pending_balance, wallet.pending_balance, 
      description, refId, 'mobile_money'
    );
    
    await client.query('COMMIT');
    return { success: true, newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Process a withdrawal from the user's wallet
 */
const processWithdrawal = async (userId, amount, refId = null, description = 'Mobile Money Withdrawal') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get wallet with row lock
    const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    if (walletRes.rows.length === 0) throw new Error('Wallet not found');
    const wallet = walletRes.rows[0];
    
    const amountNum = parseFloat(amount);
    if (parseFloat(wallet.balance) < amountNum) {
      throw new Error('Insufficient available balance');
    }
    
    const newBalance = parseFloat(wallet.balance) - amountNum;
    
    // Update balance
    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.id]);
    
    // Log transaction
    await logWalletTransaction(
      client, wallet.id, userId, 'withdrawal', amountNum, 
      wallet.balance, newBalance, wallet.pending_balance, wallet.pending_balance, 
      description, refId, 'mobile_money'
    );
    
    await client.query('COMMIT');
    return { success: true, newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lock funds in a wallet (moves from balance to pending_balance)
 */
const lockFunds = async (client, userId, amount, transactionId, description = 'Funds locked for transaction') => {
  const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
  if (walletRes.rows.length === 0) throw new Error('Wallet not found for user ' + userId);
  const wallet = walletRes.rows[0];
  
  const amountNum = parseFloat(amount);
  if (parseFloat(wallet.balance) < amountNum) {
    throw new Error('Insufficient available balance to lock funds');
  }
  
  const newBalance = parseFloat(wallet.balance) - amountNum;
  const newPending = parseFloat(wallet.pending_balance) + amountNum;
  
  await client.query('UPDATE wallets SET balance = $1, pending_balance = $2, updated_at = NOW() WHERE id = $3', 
    [newBalance, newPending, wallet.id]);
    
  await logWalletTransaction(
    client, wallet.id, userId, 'lock', amountNum, 
    wallet.balance, newBalance, wallet.pending_balance, newPending, 
    description, transactionId, 'transaction'
  );
  
  return true;
};

/**
 * Unlock funds in a wallet (moves from pending_balance back to balance)
 */
const unlockFunds = async (client, userId, amount, transactionId, description = 'Funds unlocked/refunded') => {
  const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
  if (walletRes.rows.length === 0) throw new Error('Wallet not found');
  const wallet = walletRes.rows[0];
  
  const amountNum = parseFloat(amount);
  if (parseFloat(wallet.pending_balance) < amountNum) {
    throw new Error('Insufficient pending balance to unlock');
  }
  
  const newBalance = parseFloat(wallet.balance) + amountNum;
  const newPending = parseFloat(wallet.pending_balance) - amountNum;
  
  await client.query('UPDATE wallets SET balance = $1, pending_balance = $2, updated_at = NOW() WHERE id = $3', 
    [newBalance, newPending, wallet.id]);
    
  await logWalletTransaction(
    client, wallet.id, userId, 'unlock', amountNum, 
    wallet.balance, newBalance, wallet.pending_balance, newPending, 
    description, transactionId, 'transaction'
  );
  
  return true;
};

/**
 * Release locked funds and transfer to destination wallet
 * Takes commission into account.
 */
const transferLockedFunds = async (client, fromUserId, toUserId, amount, commissionRate, transactionId, description) => {
  const amountNum = parseFloat(amount);
  const commissionAmount = amountNum * commissionRate;
  const transferAmount = amountNum - commissionAmount;

  // 1. Process Sender (unlock and immediately deduct)
  const fromWalletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [fromUserId]);
  const fromWallet = fromWalletRes.rows[0];
  
  if (parseFloat(fromWallet.pending_balance) < amountNum) {
    throw new Error('Insufficient pending balance for transfer');
  }
  
  const fromNewPending = parseFloat(fromWallet.pending_balance) - amountNum;
  await client.query('UPDATE wallets SET pending_balance = $1, updated_at = NOW() WHERE id = $2', 
    [fromNewPending, fromWallet.id]);
    
  await logWalletTransaction(
    client, fromWallet.id, fromUserId, 'transfer_out', amountNum, 
    fromWallet.balance, fromWallet.balance, fromWallet.pending_balance, fromNewPending, 
    description, transactionId, 'transaction'
  );

  // 2. Process Receiver (add to balance)
  const toWalletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [toUserId]);
  const toWallet = toWalletRes.rows[0];
  
  const toNewBalance = parseFloat(toWallet.balance) + transferAmount;
  await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', 
    [toNewBalance, toWallet.id]);
    
  await logWalletTransaction(
    client, toWallet.id, toUserId, 'transfer_in', transferAmount, 
    toWallet.balance, toNewBalance, toWallet.pending_balance, toWallet.pending_balance, 
    description, transactionId, 'transaction'
  );

  // 3. Process Platform Commission
  if (commissionAmount > 0) {
    await client.query(
      'UPDATE platform_account SET balance = balance + $1, total_commissions = total_commissions + $1, total_transactions = total_transactions + 1, updated_at = NOW() WHERE id = 1',
      [commissionAmount]
    );
    // Log commission as an out transaction for the receiver for clarity, or just keep platform account updated.
    // For clarity, we've already deducted it from the transferred amount, but let's log the commission explicitly on the receiver's end
    await logWalletTransaction(
      client, toWallet.id, toUserId, 'commission', commissionAmount, 
      toNewBalance, toNewBalance, toWallet.pending_balance, toWallet.pending_balance, 
      'Platform commission (5%)', transactionId, 'transaction'
    );
  }

  return true;
};

module.exports = {
  processDeposit,
  processWithdrawal,
  lockFunds,
  unlockFunds,
  transferLockedFunds
};
