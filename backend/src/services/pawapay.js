require('dotenv').config();

const isProduction = process.env.PAWAPAY_ENV === 'production';
const PAWAPAY_API_TOKEN = process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_API_KEY || process.env.PAYMENT_API_TOKEN || (isProduction ? '' : 'sandbox_test_token_placeholder');
const BASE_URL = process.env.PAWAPAY_BASE_URL || (isProduction ? 'https://api.pawapay.io' : 'https://api.sandbox.pawapay.io');

/**
 * Determines whether mock fallback mode is active.
 * Never active in production.
 */
function isMockMode() {
  if (isProduction) {
    return false;
  }
  return !PAWAPAY_API_TOKEN || PAWAPAY_API_TOKEN === 'sandbox_test_token_placeholder';
}

/**
 * Gets HTTP headers for PawaPay API calls.
 */
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PAWAPAY_API_TOKEN}`
  };
}

/**
 * Predicts correspondent, currency, and country from phone number.
 * Fallbacks to common African prefixes for real-feel sandbox testing if API fails or token is placeholder.
 */
async function detectCorrespondent(phone) {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  // Call PawaPay predict-correspondent endpoint
  try {
    const response = await fetch(`${BASE_URL}/v1/predict-correspondent`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phoneNumber: cleanPhone })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.correspondent) {
        return {
          correspondent: data.correspondent,
          currency: data.currency || 'XAF',
          country: data.country || 'CMR'
        };
      }
    }
  } catch (err) {
    console.warn('⚠️ PawaPay predict-correspondent failed, using local prediction rules:', err.message);
  }

  // Fallback / local offline prediction rules:
  // 237 -> Cameroon (XAF)
  // 233 -> Ghana (GHS)
  // 254 -> Kenya (KES)
  // 256 -> Uganda (UGX)
  // 225 -> Ivory Coast (XOF)
  // 221 -> Senegal (XOF)
  
  if (cleanPhone.startsWith('237')) {
    // Cameroon MTN or Orange
    const isOrange = cleanPhone.startsWith('23769') || cleanPhone.startsWith('237655') || cleanPhone.startsWith('237656') || cleanPhone.startsWith('237657');
    return {
      correspondent: isOrange ? 'ORANGE_CMR' : 'MTN_MOMO_CMR',
      currency: 'XAF',
      country: 'CMR'
    };
  } else if (cleanPhone.startsWith('233')) {
    return {
      correspondent: 'MTN_MOMO_GHA',
      currency: 'GHS',
      country: 'GHA'
    };
  } else if (cleanPhone.startsWith('254')) {
    return {
      correspondent: 'MPESA_KEN',
      currency: 'KES',
      country: 'KEN'
    };
  } else if (cleanPhone.startsWith('256')) {
    return {
      correspondent: 'MTN_MOMO_UGA',
      currency: 'UGX',
      country: 'UGA'
    };
  } else if (cleanPhone.startsWith('225')) {
    return {
      correspondent: 'MTN_MOMO_CIV',
      currency: 'XOF',
      country: 'CIV'
    };
  }

  // Default fallback
  return {
    correspondent: 'MTN_MOMO_CMR',
    currency: 'XAF',
    country: 'CMR'
  };
}

/**
 * Checks operator configuration availability.
 */
async function checkOperatorAvailability(correspondent) {
  try {
    const response = await fetch(`${BASE_URL}/v2/active-conf`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      console.warn(`PawaPay active-conf returned status: ${response.status}`);
      return true;
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      const active = data.some(conf => conf.correspondent === correspondent);
      return active;
    }
    return true;
  } catch (err) {
    console.error('⚠️ PawaPay checkOperatorAvailability failed:', err.message);
    return true;
  }
}

/**
 * Initiates deposit request (payment from client to platform).
 */
async function initiateDeposit(depositId, phoneNumber, amount, currency, correspondent) {
  if (isMockMode()) {
    console.warn('⚠️ PawaPay Deposit mock activated (placeholder token)');
    return { status: 'ACCEPTED', depositId };
  }

  const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
  const body = {
    depositId: depositId,
    amount: String(amount),
    currency: currency,
    payer: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: cleanPhone,
        provider: correspondent
      }
    }
  };

  try {
    const response = await fetch(`${BASE_URL}/v2/deposits`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`PawaPay returned non-JSON response: ${text}`);
    }

    if (!response.ok) {
      if (response.status === 401 && isMockMode()) {
        console.warn('⚠️ PawaPay Deposit unauthorized (401). Falling back to mock.');
        return { status: 'ACCEPTED', depositId };
      }
      throw new Error(data.message || data.error || `Deposit failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    if (isMockMode()) {
      console.warn('⚠️ PawaPay initiateDeposit error, falling back to mock:', err.message);
      return { status: 'ACCEPTED', depositId };
    }
    throw err;
  }
}

/**
 * Initiates payout request (release to provider).
 */
async function initiatePayout(payoutId, phoneNumber, amount, currency, correspondent) {
  if (isMockMode()) {
    console.warn('⚠️ PawaPay Payout mock activated (placeholder token)');
    return { status: 'ACCEPTED', payoutId };
  }

  const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
  const body = {
    payoutId: payoutId,
    amount: String(amount),
    currency: currency,
    recipient: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: cleanPhone,
        provider: correspondent
      }
    }
  };

  try {
    const response = await fetch(`${BASE_URL}/v2/payouts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`PawaPay returned non-JSON response: ${text}`);
    }

    if (!response.ok) {
      if (response.status === 401 && isMockMode()) {
        console.warn('⚠️ PawaPay Payout unauthorized (401). Falling back to mock.');
        return { status: 'ACCEPTED', payoutId };
      }
      throw new Error(data.message || data.error || `Payout failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    if (isMockMode()) {
      console.warn('⚠️ PawaPay initiatePayout error, falling back to mock:', err.message);
      return { status: 'ACCEPTED', payoutId };
    }
    throw err;
  }
}

/**
 * Initiates refund request.
 */
async function initiateRefund(refundId, originalDepositId, amount, currency) {
  if (isMockMode()) {
    console.warn('⚠️ PawaPay Refund mock activated (placeholder token)');
    return { status: 'ACCEPTED', refundId };
  }

  const body = {
    refundId: refundId,
    originalDepositId: originalDepositId,
    amount: String(amount),
    currency: currency
  };

  try {
    const response = await fetch(`${BASE_URL}/v2/refunds`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`PawaPay returned non-JSON response: ${text}`);
    }

    if (!response.ok) {
      if (response.status === 401 && isMockMode()) {
        console.warn('⚠️ PawaPay Refund unauthorized (401). Falling back to mock.');
        return { status: 'ACCEPTED', refundId };
      }
      throw new Error(data.message || data.error || `Refund failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    if (isMockMode()) {
      console.warn('⚠️ PawaPay initiateRefund error, falling back to mock:', err.message);
      return { status: 'ACCEPTED', refundId };
    }
    throw err;
  }
}

/**
 * Polls deposit status manually.
 */
async function pollDepositStatus(depositId) {
  if (isMockMode()) {
    return { status: 'COMPLETED', depositId };
  }

  try {
    const response = await fetch(`${BASE_URL}/v2/deposits/${depositId}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      if (response.status === 401 && isMockMode()) {
        return { status: 'COMPLETED', depositId };
      }
      throw new Error(`Polling deposit failed with status ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (isMockMode()) {
      console.warn('⚠️ PawaPay pollDepositStatus error, falling back to mock COMPLETED:', err.message);
      return { status: 'COMPLETED', depositId };
    }
    throw err;
  }
}

/**
 * Polls payout (withdrawal) status manually.
 */
async function pollPayoutStatus(payoutId) {
  if (isMockMode()) {
    return { status: 'COMPLETED', payoutId };
  }

  try {
    const response = await fetch(`${BASE_URL}/v2/payouts/${payoutId}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      if (response.status === 401 && isMockMode()) {
        return { status: 'COMPLETED', payoutId };
      }
      throw new Error(`Polling payout failed with status ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (isMockMode()) {
      console.warn('⚠️ PawaPay pollPayoutStatus error, falling back to mock COMPLETED:', err.message);
      return { status: 'COMPLETED', payoutId };
    }
    throw err;
  }
}

/**
 * Triggers callback resend for deposit ID.
 */
async function resendCallback(depositId) {
  if (isMockMode()) {
    return { status: 'SENT', depositId };
  }

  try {
    const response = await fetch(`${BASE_URL}/v2/deposits/${depositId}/resend-callback`, {
      method: 'POST',
      headers: getHeaders()
    });

    if (!response.ok) {
      const alternateRes = await fetch(`${BASE_URL}/v2/deposits/resend-callback`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ depositId })
      });
      if (!alternateRes.ok) {
        if (response.status === 401 && isMockMode()) {
          return { status: 'SENT', depositId };
        }
        throw new Error(`Resend callback failed with status ${response.status}`);
      }
      return await alternateRes.json();
    }

    return await response.json();
  } catch (err) {
    if (isMockMode()) {
      console.warn('⚠️ PawaPay resendCallback error, falling back to mock SENT:', err.message);
      return { status: 'SENT', depositId };
    }
    throw err;
  }
}

module.exports = {
  detectCorrespondent,
  checkOperatorAvailability,
  initiateDeposit,
  initiatePayout,
  initiateRefund,
  pollDepositStatus,
  pollPayoutStatus,
  resendCallback
};
