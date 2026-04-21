// ============================================================
// Netlify Function: subscribe.js
// Adds an email to Kit (formerly ConvertKit) subscriber list
// and tags them as "Skin Lineup"
//
// ENVIRONMENT VARIABLES to set in Netlify dashboard:
//   KIT_API_KEY    — your Kit V3 API key
//   KIT_API_SECRET — your Kit V3 API secret
//   KIT_TAG_ID     — 19037578
// ============================================================

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // CORS headers so the browser can call this
  const headers = {
    'Access-Control-Allow-Origin': 'https://lisaprussickmd.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { email } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const KIT_API_KEY    = process.env.KIT_API_KEY;
    const KIT_API_SECRET = process.env.KIT_API_SECRET;
    const KIT_TAG_ID     = process.env.KIT_TAG_ID || '19037578';

    // Add subscriber and tag them in one call
    const response = await fetch(`https://api.convertkit.com/v3/tags/${KIT_TAG_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KIT_API_KEY,
        api_secret: KIT_API_SECRET,
        email,
        first_name: '',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Kit error:', data);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Kit error' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, subscriber: data.subscription?.subscriber?.id }),
    };

  } catch (err) {
    console.error('Subscribe error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
