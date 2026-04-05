/**
 * clerq — scan-bill Netlify Function
 * Proxies Gemini AI requests server-side.
 * API key never reaches the client.
 */

exports.handler = async function(event) {
  // CORS preflight
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[clerq] GEMINI_API_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { image, mimeType } = body;

  // Validate
  if (!image || typeof image !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing image' }) };
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported image type' }) };
  }

  // Size guard — base64 of 5MB = ~6.8MB string
  if (image.length > 7_000_000) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: 'Image too large. Please use a smaller image.' }) };
  }

  const PROMPT = `You are an expert restaurant receipt scanner.

Analyze this receipt image carefully and extract ALL food and drink line items.

RULES:
1. Extract ONLY food and drink items
2. EXCLUDE: tax (מע"מ), service charge, tip (טיפ), total (סה"כ), subtotal, discounts
3. READ THE QUANTITY COLUMN — if an item appears with quantity 2, include it TWICE as separate entries
4. Use the UNIT PRICE (not total price) for each entry
5. Keep item names exactly as written (Hebrew or English)
6. Return ONLY a valid JSON array — no markdown, no explanation, no code fences
7. Format: [{"name":"item name","price":12.50}]
8. Price must be a number
9. If unreadable, return: []

Example:
Receipt: "המבורגר קלאסי | ₪68 | qty:2 | ₪136"
Output: [{"name":"המבורגר קלאסי","price":68},{"name":"המבורגר קלאסי","price":68}]`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: image } }
            ]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    clearTimeout(timeout);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[clerq] Gemini error:', geminiRes.status, errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error', items: [] }) };
    }

    const data = await geminiRes.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Clean response
    text = text.trim()
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    // Extract JSON array
    const start = text.indexOf('[');
    const end   = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      text = text.slice(start, end + 1);
    }

    // Parse and validate
    let items = [];
    try {
      items = JSON.parse(text);
    } catch {
      console.warn('[clerq] Failed to parse AI response:', text);
      items = [];
    }

    if (!Array.isArray(items)) items = [];

    const validated = items
      .filter(item =>
        item &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        typeof item.price === 'number' &&
        item.price > 0 &&
        item.price < 10000 // Sanity check
      )
      .map(item => ({
        name:  item.name.trim().slice(0, 80), // Max name length
        price: Math.round(item.price * 100) / 100
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: validated, count: validated.length })
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { statusCode: 504, headers, body: JSON.stringify({ error: 'Request timeout', items: [] }) };
    }
    console.error('[clerq] Function error:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Network error', items: [] }) };
  }
};
