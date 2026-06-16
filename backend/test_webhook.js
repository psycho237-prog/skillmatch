async function testWebhook() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/webhooks/mobile-money/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        depositId: '38a185e8-e3f8-491b-8bc4-db750b401cbe',
        status: 'COMPLETED',
        amount: "500",
        currency: "XAF"
      })
    });
    const text = await res.text();
    console.log("Webhook Response Status:", res.status);
    console.log("Webhook Response Text:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testWebhook();
