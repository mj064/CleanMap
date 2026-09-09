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

// AI provider defaults — auto-selected by key prefix in /api/ai/analyze
const AI_DEFAULTS = {
  gemini:     { model: null, baseUrl: null },
  groq:       { model: 'meta-llama/llama-4-scout-17b-16e-instruct', baseUrl: 'https://api.groq.com/openai/v1' },
  openrouter: { model: 'dots-studio/dots-3-note-preview:free', baseUrl: 'https://openrouter.ai/api/v1' },
  openai:     { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' }
};

function detectAiProvider(key) {
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('sk-')) return 'openai';
  if (key.startsWith('AIza') || key.startsWith('AQ.')) return 'gemini';
  return 'gemini';
}

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
    ...(ai_summary ? { ai_summary } : {}),
    ...(req.body.ai_is_waste !== undefined ? { ai_is_waste: !!req.body.ai_is_waste } : {})
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
  const { volunteer, user_id, group_name } = req.body;

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'in-progress', volunteer: volunteer || 'Anonymous', ...(user_id ? { user_id } : {}), ...(group_name ? { group_name } : {}) })
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

  // 🤖 AI verification: compare before/after photos before marking verified
  let aiVerified = null;
  try {
    const { data: existing } = await supabase
      .from('reports')
      .select('photo')
      .eq('id', id)
      .single();
    if (afterPhotoUrl && existing?.photo) {
      const verdict = await verifyCleanupAI(existing.photo, afterPhotoUrl);
      if (verdict) aiVerified = verdict.cleaned;
    }
  } catch (e) {
    console.error('AI verification skipped:', e.message);
  }

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'cleaned', after_photo: afterPhotoUrl, ...(aiVerified !== null ? { ai_verified: aiVerified } : {}) })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data, aiVerified });
});

// POST: AI vision triage of an evidence photo.
// Supports Gemini (default) or OpenAI. Requires AI_API_KEY in env.
app.post('/api/ai/analyze', async (req, res) => {
  const { photoBase64 } = req.body;
  if (!photoBase64) return res.status(400).json({ success: false, error: 'photoBase64 is required' });

  const aiKey = process.env.AI_API_KEY;
  let aiProvider = (process.env.AI_PROVIDER || detectAiProvider(aiKey)).toLowerCase();
  if (!process.env.AI_PROVIDER) {
    aiProvider = detectAiProvider(aiKey);
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
    let lastGeminiError = '';

    if (aiProvider === 'openai' || aiProvider === 'groq' || aiProvider === 'openrouter') {
      const defaults = AI_DEFAULTS[aiProvider] || AI_DEFAULTS.openai;
      const baseUrl = (process.env.AI_BASE_URL || defaults.baseUrl).replace(/\/$/, '');
      // Model chain — free-tier routers rotate their backing models, so try
      // several until one returns usable content.
      const modelChain = [
        process.env.AI_MODEL,
        defaults.model,
        ...(aiProvider === 'openrouter' ? [
          'openrouter/free',
          'google/gemma-4-26b-a4b-it:free',
          'google/gemma-4-31b-it:free'
        ] : [])
      ].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);

      let lastErr = '';
      const sleep = (ms) => new Promise(res => setTimeout(res, ms));
      for (const model of modelChain) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const r = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiKey}` },
            body: JSON.stringify({
              model,
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
          if (r.status === 429 && attempt === 0) {
            // Rate-limited — wait briefly and retry the same model once
            await sleep(5000);
            continue;
          }
          if (!r.ok) { lastErr = `${aiProvider}/${model}: HTTP ${r.status}`; break; }
          const j = await r.json();
          const content = j.choices?.[0]?.message?.content;
          if (content) { rawText = content; break; }
          lastErr = `${aiProvider}/${model}: empty content`;
          break;
        }
        if (rawText) break;
      }
      if (!rawText) throw new Error(`No working ${aiProvider} model. Last: ${lastErr}`);
    } else {
      // Fallback chain — try each model under BOTH API versions (v1 & v1beta).
      // Auth style depends on key format:
      //   "AIza…" (classic API key)   → x-goog-api-key header
      //   "AQ.…"  (new AI Studio key) → Authorization: Bearer
      // If the primary style is blocked, the alternate is tried before giving up.
      // Chain starts with the always-current alias, then newest generations —
      // older models are retired for newly-created keys.
      const models = [process.env.AI_MODEL, 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
        .filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
      const versions = ['v1beta', 'v1'];
      const primaryAuth = aiKey.startsWith('AQ.')
        ? { 'Authorization': `Bearer ${aiKey}` }
        : { 'x-goog-api-key': aiKey };
      const altAuth = aiKey.startsWith('AQ.')
        ? { 'x-goog-api-key': aiKey }
        : { 'Authorization': `Bearer ${aiKey}` };

      outer:
      for (const aiModel of models) {
        for (const ver of versions) {
          for (const headers of [primaryAuth, altAuth]) {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/${ver}/models/${aiModel}:generateContent`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
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
              break outer;
            }
            if (r.status !== 404 && r.status !== 401 && r.status !== 403) throw new Error(`Gemini error ${r.status}`);
            try { const eb = await r.json(); lastGeminiError = `${ver}/${aiModel}: ${eb?.error?.message || r.status}`; } catch { lastGeminiError = `${ver}/${aiModel}: HTTP ${r.status}`; }
          }
        }
      }
      if (!rawText) throw new Error(`No working Gemini auth/model combination. Last: ${lastGeminiError}`.trim());
    }

    if (!rawText) throw new Error('Empty AI response');

    // Strip markdown fences and extract the JSON object — LLMs often add
    // safety preambles or commentary around the payload
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

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
// ── AI cleanup verification: compare before/after photos ──
async function verifyCleanupAI(beforeUrl, afterUrl) {
  const aiKey = process.env.AI_API_KEY;
  if (!aiKey || !beforeUrl || !afterUrl) return null;
  const provider = detectAiProvider(aiKey);
  const defaults = AI_DEFAULTS[provider] || AI_DEFAULTS.gemini;
  const prompt = `You are verifying a community cleanup. Image 1 is BEFORE (waste present). Image 2 is AFTER (claimed cleaned) — same location.
Did the waste actually get cleaned up? Reply ONLY valid JSON (no markdown): {"cleaned": boolean, "confidence": 0-1, "note": "max 120 chars"}`;

  try {
    const [bRes, aRes] = await Promise.all([fetch(beforeUrl), fetch(afterUrl)]);
    if (!bRes.ok || !aRes.ok) return null;
    const b64b = Buffer.from(await bRes.arrayBuffer()).toString('base64');
    const b64a = Buffer.from(await aRes.arrayBuffer()).toString('base64');
    let rawText = null;

    if (provider === 'gemini') {
      const models = [process.env.AI_MODEL, 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash']
        .filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
      const headers = aiKey.startsWith('AQ.')
        ? { 'Authorization': `Bearer ${aiKey}` }
        : { 'x-goog-api-key': aiKey };
      outer:
      for (const m of models) {
        for (const ver of ['v1beta', 'v1']) {
          const r = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: 'image/jpeg', data: b64b } },
                  { inline_data: { mime_type: 'image/jpeg', data: b64a } }
                ]
              }]
            })
          });
          if (r.ok) {
            const j = await r.json();
            rawText = j.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) break outer;
          }
        }
      }
    } else {
      const baseUrl = (process.env.AI_BASE_URL || defaults.baseUrl).replace(/\/$/, '');
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: process.env.AI_MODEL || defaults.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: beforeUrl } },
              { type: 'image_url', image_url: { url: afterUrl } }
            ]
          }],
          max_tokens: 300
        })
      });
      if (r.ok) {
        const j = await r.json();
        rawText = j.choices?.[0]?.message?.content;
      }
    }

    if (!rawText) return null;
    const jsonMatch = rawText.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return { cleaned: !!parsed.cleaned, confidence: Number(parsed.confidence) || 0, note: parsed.note || '' };
  } catch (err) {
    console.error('verifyCleanupAI failed:', err.message);
    return null;
  }
}

// POST: check whether the caller (by auth token) is a moderator
app.post('/api/moderator/check', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const allow = (process.env.MODERATOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!token || !supabase || !allow.length) return res.json({ success: true, data: { moderator: false } });
  try {
    const { data } = await supabase.auth.getUser(token);
    const email = data?.user?.email?.toLowerCase() || null;
    res.json({ success: true, data: { moderator: !!email && allow.includes(email), email } });
  } catch {
    res.json({ success: true, data: { moderator: false } });
  }
});

// DELETE a report (moderators only — validated via auth token + allowlist)
app.delete('/api/reports/:id', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const allow = (process.env.MODERATOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!supabase) return res.status(500).json({ success: false, error: 'Database not connected' });

  let email = null;
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      email = data?.user?.email?.toLowerCase() || null;
    } catch { /* invalid token */ }
  }
  if (!allow.length || !email || !allow.includes(email)) {
    return res.status(403).json({ success: false, error: 'Moderator access required' });
  }

  const { error } = await supabase.from('reports').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

// ── Group system ──
async function getAuthUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser(token);
    return data?.user ? { id: data.user.id, email: (data.user.email || '').toLowerCase(), name: data.user.user_metadata?.name || (data.user.email || '').split('@')[0] } : null;
  } catch { return null; }
}

// Groups: list all (with active member counts)
app.get('/api/groups', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false, error: 'Database not connected' });
  try {
    const { data: groups } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
    const { data: members } = await supabase.from('group_members').select('group_id, status');
    const counts = {};
    (members || []).forEach(m => { if (m.status === 'active') counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
    res.json({
      success: true,
      data: (groups || []).map(g => ({ id: g.id, name: g.name, leader_id: g.leader_id, members: counts[g.id] || 1 }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Groups: my memberships + (as leader) pending join requests
app.get('/api/groups/mine', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Sign in required' });
  try {
    const { data: mine } = await supabase.from('group_members').select('*, groups(name)').eq('user_id', user.id);
    const active = (mine || []).find(m => m.status === 'active' && m.groups?.name) || null;
    const pending = (mine || []).filter(m => m.status === 'pending').map(m => ({ id: m.id, group_id: m.group_id, name: m.groups?.name }));

    let leaderRequests = [];
    if (active && active.role === 'leader') {
      const { data: reqs } = await supabase.from('group_members')
        .select('id, requester_name, created_at').eq('group_id', active.group_id).eq('status', 'pending');
      leaderRequests = reqs || [];
    }
    res.json({ success: true, data: { active, pending, leaderRequests } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Groups: create (creator becomes leader)
app.post('/api/groups', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Sign in required' });
  const name = (req.body.name || '').trim();
  if (!name || name.length > 40) return res.status(400).json({ success: false, error: 'Group name required (max 40 chars)' });
  try {
    const { data: existing } = await supabase.from('groups').select('id').ilike('name', name).maybeSingle();
    if (existing) return res.status(409).json({ success: false, error: 'That group name is taken' });

    const { data: group, error } = await supabase.from('groups').insert({ name, leader_id: user.id }).select().single();
    if (error) throw error;
    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, requester_name: user.name, role: 'leader', status: 'active' });
    await supabase.from('profiles').upsert({ id: user.id, group_name: name });
    res.json({ success: true, data: group });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Groups: request to join
app.post('/api/groups/:id/join', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Sign in required' });
  try {
    const { error } = await supabase.from('group_members')
      .insert({ group_id: req.params.id, user_id: user.id, requester_name: req.body.requester_name || user.name, status: 'pending' });
    if (error) return res.status(409).json({ success: false, error: error.code === '23505' ? 'Already a member or request pending' : error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Groups: leader approves/rejects a join request
app.post('/api/groups/:id/decide', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Sign in required' });
  const { member_id, approve } = req.body;
  if (!member_id) return res.status(400).json({ success: false, error: 'member_id required' });
  try {
    const { data: group } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
    if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
    if (group.leader_id !== user.id) return res.status(403).json({ success: false, error: 'Only the group leader can decide' });

    if (approve) {
      const { data: member } = await supabase.from('group_members').select('*').eq('id', member_id).single();
      const { error } = await supabase.from('group_members').update({ status: 'active' }).eq('id', member_id);
      if (error) throw error;
      if (member?.user_id) await supabase.from('profiles').upsert({ id: member.user_id, group_name: group.name });
      res.json({ success: true, data: { approved: true } });
    } else {
      const { error } = await supabase.from('group_members').delete().eq('id', member_id);
      if (error) throw error;
      res.json({ success: true, data: { approved: false } });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Groups: leave (leaders must keep leading)
app.post('/api/groups/:id/leave', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ success: false, error: 'Sign in required' });
  try {
    const { data: group } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
    if (group && group.leader_id === user.id) {
      return res.status(400).json({ success: false, error: 'Leaders cannot leave their group' });
    }
    const { error } = await supabase.from('group_members').delete().eq('group_id', req.params.id).eq('user_id', user.id);
    if (error) throw error;
    await supabase.from('profiles').upsert({ id: user.id, group_name: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
