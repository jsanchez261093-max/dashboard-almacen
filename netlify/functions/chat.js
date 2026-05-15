const https = require('https');

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch(e) {
          resolve({ status: res.statusCode, data: { error: raw } });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // CORS preflight — MUST be first
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAQcWP6tTcpt_jmavBIDxt8B_xkHA3cFfM';

    const body = JSON.parse(event.body);

    const contents = [];
    if (body.system) {
      contents.push({ role: 'user',  parts: [{ text: body.system }] });
      contents.push({ role: 'model', parts: [{ text: 'Entendido. Listo para analizar los KPIs.' }] });
    }
    for (const m of (body.messages || [])) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    }

    const geminiBody = {
      contents,
      generationConfig: { maxOutputTokens: 800, temperature: 0.3 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const result = await httpsPost(url, geminiBody);

    if (result.status !== 200) {
      return {
        statusCode: result.status, headers,
        body: JSON.stringify({ error: result.data?.error?.message || 'Gemini error' })
      };
    }

    const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };

  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
