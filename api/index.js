require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_KEY;
// Optional: service_role key for server-side writes (bypasses RLS).
// NEVER expose this to the browser — only /api/config's anon key is public.
const serviceKey = process.env.SUPABASE_SERVICE_KEY || null;

if (!supabaseUrl || !anonKey) {
  console.error("❌ ERROR: SUPABASE_URL or SUPABASE_KEY is missing from environment variables.");
}

const supabase = (supabaseUrl && anonKey)
  ? createClient(supabaseUrl, serviceKey || anonKey)
  : null;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (Primarily for local development)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ── API Endpoints ──

// Health check for Vercel debugging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    supabase_configured: !!supabase,
    service_key_configured: !!serviceKey,
    ai_configured: !!process.env.AI_API_KEY,
    env: process.env.NODE_ENV
  });
});

// Deliver public keys to frontend for WebSockets
app.get('/api/config', (req, res) => {
  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ success: false, error: "Supabase keys missing in Vercel" });
  }
  res.json({
    success: true,
    data: {
      url: supabaseUrl,
      key: anonKey
    }
  });
});

// GET all reports
app.get('/api/reports', async (req, res) => {
  const { search } = req.query;
  
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

// POST a new report (with Cloud Storage for Photo)
app.post('/api/reports', async (req, res) => {
  const { title, location, description, severity, lat, lng, reporter, user_id, photoBase64,
          ai_category, ai_severity, ai_summary } = req.body;

  let photoUrl = null;

  // Process and upload base64 image if present
  if (photoBase64 && supabase) {
    try {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `evidence_${Date.now()}_${uuidv4().substring(0,6)}.jpg`;

      // Upload directly to Supabase Storage bucket
      const { data, error } = await supabase.storage
        .from('cleanmap-evidence')
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) throw error;

      // Construct public URL
      const { data: publicUrlData } = supabase.storage
        .from('cleanmap-evidence')
        .getPublicUrl(filename);
        
      photoUrl = publicUrlData.publicUrl;
    } catch (err) {
      console.error('Image upload failed to cloud storage:', err.message);
    }
  }

  const newReport = {
    title, location, description, severity, lat, lng, reporter,
    photo: photoUrl,
    status: 'reported',
    ...(user_id ? { user_id } : {}),
    ...(ai_category ? { ai_category } : {}),
    ...(ai_severity ? { ai_severity } : {}),
    ...(ai_summary ? { ai_summary } : {})
  };

  if (!supabase) return res.status(500).json({ success: false, error: "Database not connected" });

  const { data, error } = await supabase
    .from('reports')
    .insert([newReport])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

// PATCH: Claim a report
app.patch('/api/reports/:id/claim', async (req, res) => {
  const { id } = req.params;
  const { volunteer, user_id } = req.body;

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'in-progress', volunteer: volunteer || 'Anonymous', ...(user_id ? { user_id } : {}) })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// PATCH: Mark cleaned (With Before/After photo logic)
app.patch('/api/reports/:id/clean', async (req, res) => {
  const { id } = req.params;
  const { afterPhotoBase64 } = req.body;

  let afterPhotoUrl = null;

  if (afterPhotoBase64 && supabase) {
    try {
      const base64Data = afterPhotoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `proof_${Date.now()}_${uuidv4().substring(0,6)}.jpg`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('cleanmap-evidence')
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('cleanmap-evidence')
        .getPublicUrl(filename);
      
      afterPhotoUrl = publicUrlData.publicUrl;
    } catch (err) {
      console.error('Proof image upload failed:', err.message);
    }
  }

  if (!supabase) return res.status(500).json({ success: false, error: "Database not connected" });

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'cleaned', after_photo: afterPhotoUrl })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// POST: AI vision triage of an evidence photo.
// Supports Gemini (default) or OpenAI. Requires AI_API_KEY in env.
app.post('/api/ai/analyze', async (req, res) => {
  const { photoBase64 } = req.body;
  if (!photoBase64) return res.status(400).json({ success: false, error: 'photoBase64 is required' });

  const aiKey = process.env.AI_API_KEY;
  let aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  // Auto-detect provider from key format: OpenAI keys start with "sk-", Google's with "AIza"
  if (!process.env.AI_PROVIDER) {
    if (aiKey.startsWith('sk-')) aiProvider = 'openai';
    else if (aiKey.startsWith('AIza')) aiProvider = 'gemini';
  }
  if (!aiKey) {
    return res.status(503).json({ success: false, error: 'AI not configured (set AI_API_KEY)' });
  }

  const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
  const systemPrompt = `You are a waste-report triage assistant for a community cleanup platform.
Analyze the attached photo of an alleged waste/dumping site.
Respond with ONLY a valid JSON object (no markdown, no extra text) with exactly these keys:
{"is_waste": boolean, "category": "plastic"|"organic"|"e-waste"|"construction"|"hazardous"|"other", "severity": "low"|"medium"|"high", "suggested_title": string (max 60 chars, concise report title), "suggested_description": string (max 200 chars, what is visible and why it matters), "confidence": number between 0 and 1}
If the photo contains no waste, set is_waste false and keep other fields minimal.`;

  try {
    let rawText = null;
    let diagInfo = '';

    if (aiProvider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
            ]
          }],
          max_tokens: 400
        })
      });
      if (!r.ok) throw new Error(`OpenAI error ${r.status}`);
      const j = await r.json();
      rawText = j.choices?.[0]?.message?.content;
    } else {
      // Fallback chain — Google retires model names; try newest first
      const models = [process.env.AI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
        .filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);

      for (const aiModel of models) {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${aiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                ]
              }]
            })
          }
        );
        if (r.ok) {
          const j = await r.json();
          rawText = j.candidates?.[0]?.content?.parts?.[0]?.text;
          break;
        }
        if (r.status !== 404) throw new Error(`Gemini error ${r.status}`);
        // 404 = model not available for this key → try next in chain
      }
      if (!rawText) {
        // Last resort: ask Google which models this key can actually use
        const lr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${aiKey}&pageSize=50`);
        if (lr.ok) {
          const lm = await lr.json();
          const candidate = (lm.models || []).find(m =>
            (m.supportedGenerationMethods || []).includes('generateContent') &&
            /flash/i.test(m.name) && !/embedding|tts|image/i.test(m.name)
          );
          if (candidate) {
            const name = candidate.name.replace(/^models\//, '');
            const r2 = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent?key=${aiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      { text: systemPrompt },
                      { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                    ]
                  }]
                })
              }
            );
            if (r2.ok) {
              const j2 = await r2.json();
              rawText = j2.candidates?.[0]?.content?.parts?.[0]?.text;
            }
          } else {
            // Nothing matched — surface what Google actually returned for debugging
            const names = (lm.models || []).map(m => m.name).slice(0, 8).join(', ');
            diagInfo = `(models returned: ${names || 'NONE'})`;
          }
        } else {
          diagInfo = `list-models HTTP ${lr.status}`;
        }
      }
      if (!rawText) throw new Error(`No available Gemini model found for this API key ${diagInfo}`.trim());
    }

    if (!rawText) throw new Error('Empty AI response');

    // Strip possible markdown fences and parse
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    res.json({
      success: true,
      data: {
        is_waste: !!parsed.is_waste,
        category: parsed.category || 'other',
        severity: parsed.severity || 'medium',
        suggested_title: parsed.suggested_title || '',
        suggested_description: parsed.suggested_description || '',
        confidence: Number(parsed.confidence) || 0
      }
    });
  } catch (err) {
    console.error('AI analyze failed:', err.message);
    res.status(500).json({ success: false, error: `AI analysis failed: ${err.message}` });
  }
});

// GET Dash Stats
app.get('/api/stats', async (req, res) => {
  try {
    const { data: reports, error } = await supabase.from('reports').select('*');
    if (error) throw error;

    let total = 0, reported = 0, inProgress = 0, cleaned = 0;
    let severityCounts = { low: 0, medium: 0, high: 0 };

    reports.forEach(r => {
      total++;
      if (r.status === 'reported') reported++;
      if (r.status === 'in-progress') inProgress++;
      if (r.status === 'cleaned') cleaned++;
      
      if (severityCounts[r.severity] !== undefined) {
        severityCounts[r.severity]++;
      }
    });

    const recentActivity = reports
      .filter(r => r.status !== 'reported' || new Date(r.created_at) > new Date(Date.now() - 86400000))
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        action: r.status === 'cleaned' ? 'cleaned' : (r.status === 'in-progress' ? 'claimed' : 'created'),
        report_title: r.title,
        details: r.status === 'cleaned' ? 'Cleanup confirmed' : (r.status === 'in-progress' ? `Claimed by ${r.volunteer}` : 'New report filed'),
        created_at: r.created_at
      }));

    res.json({
      success: true,
      data: {
        total, reported, inProgress, cleaned,
        severity: severityCounts,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// For Vercel Serverless exporting, express instance must be exported
module.exports = app;

// Local development binding
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🌿 CleanMap (Supabase) Server running locally at http://localhost:${PORT}`);
  });
}
