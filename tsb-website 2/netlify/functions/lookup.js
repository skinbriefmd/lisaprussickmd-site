// ============================================================
// Netlify Function: lookup.js
// Takes a partial product name typed by the user and asks
// Claude to identify matching skincare products with their
// category and key ingredients.
// ============================================================

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': 'https://lisaprussickmd.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { query } = JSON.parse(event.body);

    if (!query || query.length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ results: [] }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You are a skincare product database. When given a partial product name or brand, return up to 5 matching real skincare products.

Respond ONLY with a JSON array, no markdown, no extra text:
[
  {"name": "Full exact product name", "detail": "key ingredient or benefit · category", "cat": "one of: cleanser|toner|serum|active|retinol|retinoid|vitc|moisturizer|oil|spf|eyecream|bpo|copper"}
]

Rules:
- Only return real products that actually exist
- "name" should be the full product name as sold (brand + product name)
- "detail" should be the 1-2 key ingredients or skin benefits, then a dot, then the product type
- "cat" must be one of the exact values listed above
- If the query is just a brand name like "cetaphil", return their most popular products
- If nothing matches, return an empty array []`,
        messages: [{ role: 'user', content: `Find skincare products matching: "${query}"` }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic lookup error:', data);
      return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) };
    }

    const text = data.content?.[0]?.text || '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const results = JSON.parse(clean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results: Array.isArray(results) ? results : [] }),
    };

  } catch (err) {
    console.error('Lookup error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) };
  }
};
