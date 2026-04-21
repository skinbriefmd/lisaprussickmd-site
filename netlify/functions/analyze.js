// ============================================================
// Netlify Function: analyze.js
// Sends skincare products to Claude API and returns
// derm-ordered routine + conflict flags
//
// ENVIRONMENT VARIABLE to set in Netlify dashboard:
//   ANTHROPIC_API_KEY — your Anthropic API key
// ============================================================

const SYSTEM_PROMPT = `You are Dr. Lisa Prussick, a board-certified dermatologist (MD, FAAD). A patient has submitted their skincare products for a routine check.

Your job is to:
1. Identify each product and what category it belongs to
2. Reorder them into the correct derm-approved layering sequence using these rules:
   - Cleanser always first (oil cleansers and cleansing balms count as cleansers, not facial oils)
   - Toner / essence second
   - Vitamin C serum third (AM only — most effective as antioxidant in morning)
   - Actives and treatments next (AHAs, BHAs, retinoids, azelaic acid, benzoyl peroxide, copper peptides) — retinoids and all actives ALWAYS come before hydrating serums in the standard order
   - Hydrating serums after actives (hyaluronic acid, niacinamide, peptide serums) — these always go AFTER actives, never before
   - Eye cream after serums
   - Moisturizer after eye cream
   - Facial oils after moisturizer (oils are occlusive — always last before SPF or final step at night)
   - SPF always last in AM — nothing goes on top

3. Flag any ingredient conflicts using these exact rules:
   - STOP (red): retinoid + AHA same routine, retinoid + BHA same routine, benzoyl peroxide + retinoid, copper peptides + Vitamin C, copper peptides + acids
   - WARN (amber): AHA + BHA together, Vitamin C + acids, niacinamide + acids, facial oil applied before serums, SPF in PM routine, retinoid in AM routine, no SPF detected in AM routine
   - NEVER flag missing SPF for PM routines — it is normal and expected not to have SPF at night
   - OK (green): Vitamin C + niacinamide — this is a myth, they are safe together

4. If a retinoid is in a morning routine, remove it from the order list entirely
   If SPF is in a PM routine, remove it from the order list entirely

5. If any retinoid is present, include a moisture sandwich tip using the EXACT term the user typed. Frame it as an OPTIONAL buffering method for those experiencing irritation — NOT the default order. The standard order (active before serum) is already shown above. The tip should say something like: "If [retinoid] is causing dryness or irritation, try the buffering method: apply a thin layer of moisturizer first, then [retinoid] on top, then moisturizer again to reduce irritation."

6. Flag pregnancy caution ONLY if these ingredients are present:
   retinoids/retinol, salicylic acid (BHA), AHA exfoliants, benzoyl peroxide, hydroquinone, chemical sunscreen filters (oxybenzone/avobenzone)

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "ordered": [
    {"name": "exact product name as user typed", "category": "one of: cleanser|toner|serum|active|moisturizer|oil|spf|eye-cream", "why": "one sentence explanation"}
  ],
  "removed": [
    {"name": "product name", "reason": "why removed from order"}
  ],
  "conflicts": [
    {"severity": "stop|warn|ok|preg|tip", "title": "short title", "desc": "one to two sentence explanation"}
  ],
  "session_notes": "one sentence overall note or empty string"
}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': 'https://lisaprussickmd.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { products, session } = JSON.parse(event.body);

    if (!products || !products.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No products provided' }) };
    }

    const sessionLabel = session === 'am' ? 'morning' : 'night';
    const userMessage = `Please analyze this ${sessionLabel} skincare routine:\n\n${products.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nReturn JSON only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI error' }) };
    }

    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (err) {
    console.error('Analyze error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
