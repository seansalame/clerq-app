export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing API key', items: [] });

  const { image, mimeType } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing image', items: [] });

  const ALLOWED = ['image/jpeg','image/png','image/webp','image/gif','image/heic'];
  if (!ALLOWED.includes(mimeType)) return res.status(400).json({ error: 'Unsupported type', items: [] });
  if (image.length > 8_000_000) return res.status(413).json({ error: 'Image too large', items: [] });

  const PROMPT = `אתה סורק קבלות ממסעדות ישראליות.

נתח את תמונת הקבלה והחזר רשימת פריטי מזון ושתייה בלבד.

חוקים:
1. כלול רק מזון ושתייה
2. אל תכלול: מע"מ, שירות, טיפ, סה"כ, הנחות
3. שים לב לכמות — אם פריט מופיע פעמיים, הכנס אותו פעמיים
4. השתמש במחיר יחידה (לא סה"כ)
5. שמור שמות בדיוק כפי שכתוב בקבלה
6. החזר JSON בלבד — ללא מרקדאון, ללא הסבר
7. פורמט: [{"name":"שם פריט","price":12.50}]
8. מחיר חייב להיות מספר חיובי
9. אם לא ניתן לקרוא — החזר: []`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: image } }
          ]}],
          generationConfig: { temperature: 0, maxOutputTokens: 2048 }
        })
      }
    );

    clearTimeout(timeout);
    if (!r.ok) return res.status(502).json({ error: 'AI error', items: [] });

    const data = await r.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    text = text.replace(/```json|```/gi,'').trim();
    const s = text.indexOf('['), e = text.lastIndexOf(']');
    if (s !== -1 && e !== -1) text = text.slice(s, e+1);

    let items = [];
    try { items = JSON.parse(text); } catch { items = []; }
    if (!Array.isArray(items)) items = [];

    const clean = items
      .filter(i => i && typeof i.name==='string' && i.name.trim() && typeof i.price==='number' && i.price>0 && i.price<10000)
      .map(i => ({ name: i.name.trim().slice(0,80), price: Math.round(i.price*100)/100 }));

    return res.status(200).json({ items: clean, count: clean.length });

  } catch(e) {
    if (e.name==='AbortError') return res.status(504).json({ error: 'Timeout', items: [] });
    return res.status(502).json({ error: 'Network error', items: [] });
  }
}
