// ═══════════════════════════════════════════
// CleanMap — Frontend Logic (Round 3)
// ═══════════════════════════════════════════

const API_BASE = '/api';
const CENTER = [12.8231, 80.0444];

let reports = [];
let activeFilter = 'all';
let currentMapStyle = 'liberty';
let sbClient = null;
let currentUser = null; // Supabase auth user (null when signed out)

// ── Points Configuration ──
const POINTS = { low: 10, medium: 25, high: 50 };
let volunteerScores = {}; // Global cache for scores

// ═══════════════════════════════════════════
// INTERNATIONALIZATION (i18n)
// ═══════════════════════════════════════════

const translations = {
  en: {
    theme: "Theme", volunteer_leaderboard: "Volunteer Leaderboard",
    severity_breakdown: "Severity Breakdown", recent_action: "Recent Action Log",
    upload_proof_title: "Submit Cleanup Proof",
    upload_proof_desc: "Please provide an 'After' photo to verify this spot is completely resolved.",
    after_photo_label: "📸 After Photo (Required)", cancel: "Cancel", submit_proof: "Submit Proof",
    global_map: "Global Map", dashboard: "Dashboard", new_report: "New Report",
    active_reports: "Active Reports", all_tab: "All", pending_tab: "Pending",
    in_progress_tab: "In Progress", cleaned_tab: "Cleaned",
    platform_stats: "Platform Statistics", platform_subs: "Real-time overview of community activity",
    file_report: "File strong report", file_report_sub: "Pinpoint a location and add details.",
    map_loc_ref: "Map Location Reference", brief_title: "Brief Title",
    landmark: "Landmark / Street", detailed_desc: "Detailed Description",
    your_name: "Your Initials/Name", evidence_image: "Evidence Image (Before)",
    severity_class: "Severity Classification", submit_system: "Submit into System",
    legend: "Legend", brand_name: "CleanMap", style_standard: "Standard",
    style_bright: "Bright", style_minimal: "Minimal", sev_high: "High Severity",
    sev_medium: "Medium Severity", sev_low: "Low Severity", in_progress: "In Progress",
    resolved: "Resolved", refresh_sync: "Refresh Sync", 
    click_map_coords: "Click on map to register coordinates", use_gps: "Use GPS",
    low: "Low", medium: "Medium", high: "High", click_override: "Click to override pin",
    claim_task: "Claim Task", upload_proof_btn: "Upload Proof & Clean",
    filed_by: "Filed by", on: "on", clean_confirmed: "Cleanup confirmed",
    new_report_filed: "New Report filed", total_logs: "Total Logs", 
    pending_action: "Pending Action", no_activity: "No activity.",
    enter_vol_name: "Enter your Volunteer Name:", proof_accepted: "Proof accepted! Spot marked Cleaned.",
    demo_label: "(Demo)",
    sign_in: "Sign In", sign_up: "Sign Up", sign_out: "Sign Out",
    auth_welcome: "Welcome to CleanMap",
    auth_sub: "Sign in to claim cleanups, earn points and build your eco-reputation.",
    near_me: "Near Me", near_me_empty: "No reports within 2 km of you.",
    lb_empty: "No cleanups yet — be the first eco-warrior! 🌱",
    empty_list: "Nothing here yet. Be the first to report!",
    still_needed: "Still needed:",
    sev_error: "Couldn't load stats. Try Refresh Sync.",
    loc_fail: "Couldn't get your location — check browser permissions."
  },
  hi: {
    theme: "थीम", volunteer_leaderboard: "स्वयंसेवक लीडरबोर्ड",
    severity_breakdown: "गंभीरता का विवरण", recent_action: "हाल की कार्रवाई",
    upload_proof_title: "प्रमाण अपलोड करें",
    upload_proof_desc: "यह सत्यापित करने के लिए कि यह स्थान पूरी तरह से साफ हो गया है, कृपया एक 'बाद' की फोटो दें।",
    after_photo_label: "📸 बाद की फोटो (आवश्यक)", cancel: "रद्द करें", submit_proof: "प्रमाण जमा करें",
    global_map: "वैश्विक मानचित्र", dashboard: "डैशबोर्ड", new_report: "नई रिपोर्ट",
    active_reports: "सक्रिय रिपोर्ट", all_tab: "सभी", pending_tab: "लंबित",
    in_progress_tab: "प्रगति पर", cleaned_tab: "साफ किया",
    platform_stats: "प्लेटफ़ॉर्म आँकड़े", platform_subs: "समुदाय की गतिविधि का रीयल-टाइम अवलोकन",
    file_report: "रिपोर्ट दर्ज करें", file_report_sub: "स्थान को पिनपॉइंट करें और विवरण जोड़ें।",
    map_loc_ref: "मानचित्र स्थान संदर्भ", brief_title: "संक्षिप्त शीर्षक",
    landmark: "लैंडमार्क / सड़क", detailed_desc: "विस्तृत विवरण",
    your_name: "आपका नाम/प्रारंभिक", evidence_image: "साक्ष्य छवि (पहले)",
    severity_class: "गंभीरता वर्गीकरण", submit_system: "सिस्टम में सबमिट करें",
    legend: "संकेतकों", brand_name: "क्लीनमैप", style_standard: "मानक",
    style_bright: "चमकीला", style_minimal: "न्यूनतम", sev_high: "उच्च गंभीरता",
    sev_medium: "मध्यम गंभीरता", sev_low: "कम गंभीरता", in_progress: "प्रगति पर",
    resolved: "सुलझाया गया", refresh_sync: "सिंक ताज़ा करें",
    click_map_coords: "निर्देशांक दर्ज करने के लिए मानचित्र पर क्लिक करें", use_gps: "जीपीएस का उपयोग करें",
    low: "कम", medium: "मध्यम", high: "उच्च", click_override: "पिन को ओवरराइड करने के लिए क्लिक करें",
    claim_task: "कार्य का दावा करें", upload_proof_btn: "प्रमाण अपलोड करें और साफ करें",
    filed_by: "द्वारा दायर", on: "को", clean_confirmed: "सफाई की पुष्टि की गई",
    new_report_filed: "नई रिपोर्ट दर्ज की गई", total_logs: "कुल लॉग", 
    pending_action: "लंबित कार्रवाई", no_activity: "कोई गतिविधि नहीं।",
    enter_vol_name: "अपना स्वयंसेवक नाम दर्ज करें:", proof_accepted: "प्रमाण स्वीकार किया गया! स्थान को साफ चिह्नित किया गया।",
    sign_in: "साइन इन", sign_up: "साइन अप", sign_out: "साइन आउट",
    auth_welcome: "CleanMap में आपका स्वागत है",
    auth_sub: "सफाई का दावा करने, अंक कमाने और अपनी इको-प्रतिष्ठा बनाने के लिए साइन इन करें।",
    near_me: "मेरे पास", near_me_empty: "आपके 2 किमी के दायरे में कोई रिपोर्ट नहीं है।",
    demo_label: "(डेमो)",
    lb_empty: "अभी कोई सफाई नहीं हुई — पहले इको-वॉरियर बनें! 🌱",
    empty_list: "यहां अभी कुछ नहीं है। पहली रिपोर्ट दर्ज करें!",
    still_needed: "अभी बाकी:",
    sev_error: "आंकड़े लोड नहीं हो सके। Refresh Sync आज़माएँ।",
    loc_fail: "आपकी लोकेशन नहीं मिली — ब्राउज़र की अनुमति जांचें।"
  }
};

let currentLang = localStorage.getItem('cleanmap_lang') || 'en';
document.getElementById('lang-select').value = currentLang;

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('cleanmap_lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

document.getElementById('lang-select').addEventListener('change', (e) => {
  applyLanguage(e.target.value);
});

// ═══════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════
function getStoredTheme() { return localStorage.getItem('cleanmap_theme') || 'light'; }
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cleanmap_theme', theme);
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});
setTheme(getStoredTheme());

// Mobile-only compact controls (the sidebar is hidden on phones)
const mobileThemeBtn = document.getElementById('mobile-theme-toggle');
if (mobileThemeBtn) {
  mobileThemeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    mobileThemeBtn.innerHTML = `<i class="ph ${next === 'dark' ? 'ph-sun' : 'ph-moon'}"></i>`;
  });
  // Sync icon with the theme restored from storage
  mobileThemeBtn.innerHTML = `<i class="ph ${getStoredTheme() === 'dark' ? 'ph-sun' : 'ph-moon'}"></i>`;
}
const mobileLangBtn = document.getElementById('mobile-lang-toggle');
if (mobileLangBtn) {
  mobileLangBtn.addEventListener('click', () => {
    applyLanguage(currentLang === 'en' ? 'hi' : 'en');
    document.getElementById('lang-select').value = currentLang;
    mobileLangBtn.querySelector('span').textContent = currentLang === 'en' ? 'हिं' : 'EN';
  });
}

// ═══════════════════════════════════════════
// MAP TILE LAYERS
// ═══════════════════════════════════════════
const TILE_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron'
};

let mainTileLayer = null, reportTileLayer = null;

function createTileLayer(map, styleKey) {
  return L.maplibreGL({ style: TILE_STYLES[styleKey], attribution: '<a href="https://openfreemap.org">OpenFreeMap</a>' }).addTo(map);
}
function updateMapTiles() {
  if (mainTileLayer && mainMap) { mainMap.removeLayer(mainTileLayer); mainTileLayer = createTileLayer(mainMap, currentMapStyle); }
  if (reportTileLayer && reportMap) { reportMap.removeLayer(reportTileLayer); reportTileLayer = createTileLayer(reportMap, currentMapStyle); }
}
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMapStyle = btn.dataset.style;
    updateMapTiles();
  });
});

// ═══════════════════════════════════════════
// SUPABASE REALTIME INITIALIZATION & CORE FETCH
// ═══════════════════════════════════════════
async function init() {
  applyLanguage(currentLang);

  // Grab keys safely generated by our Node Server / Vercel API
  try {
    const confRes = await fetch(`${API_BASE}/config`);
    const config = await confRes.json();
    
    if (config.success && config.data.url) {
      console.log("🔗 Connecting to Supabase Realtime...");
      sbClient = supabase.createClient(config.data.url, config.data.key);
      
      const channel = sbClient
        .channel('realtime-reports')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, payload => {
          console.log("⚡ Realtime Update Received:", payload.eventType);
          refreshAllQuietly();
        })
        .subscribe((status) => {
          console.log("📡 Realtime Status:", status);
        });
    }
  } catch (err) {
    console.error("❌ Realtime subscription failed:", err);
  }

  await refreshAllQuietly();
  setTimeout(() => mainMap.invalidateSize(), 150);

  // Initialize authentication (after sbClient is ready)
  await initAuth();

  // Auto-focus the map on the user's real location on load (Google Maps style)
  locateMe(true);
}

async function fetchReports(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/reports${query ? '?' + query : ''}`);
    const data = await res.json();
    if (data.success) reports = data.data;
  } catch (err) { console.error(err); }
}

async function refreshAllQuietly() {
  await fetchReports();
  calculateLeaderboard(); // Update points cache globally
  renderMapMarkers();
  renderReportCards();
  renderDashboard();
}

// ═══════════════════════════════════════════
// LEADERBOARD COMPUTATION
// ═══════════════════════════════════════════
function calculateLeaderboard() {
  volunteerScores = {};
  
  reports.forEach(r => {
    if (r.status === 'cleaned' && r.volunteer) {
      if (!volunteerScores[r.volunteer]) {
        volunteerScores[r.volunteer] = { name: r.volunteer, points: 0, count: 0 };
      }
      volunteerScores[r.volunteer].points += POINTS[r.severity] || 0;
      volunteerScores[r.volunteer].count += 1;
    }
  });

  const sortedLeaderboard = Object.values(volunteerScores).sort((a,b) => b.points - a.points);
  
  const lbContainer = document.getElementById('leaderboard-list');
  lbContainer.innerHTML = '';
  
  if (sortedLeaderboard.length === 0) {
    // Honest empty state — real scores only (mock demo data removed)
    lbContainer.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-trophy"></i>
        <p>${translations[currentLang].lb_empty}</p>
      </div>
    `;
    return;
  }

  sortedLeaderboard.forEach((vol, idx) => {
    lbContainer.innerHTML += `
      <div class="lb-row">
        <div class="lb-rank">#${idx + 1}</div>
        <div class="lb-name">${vol.name}</div>
        <div class="lb-score">
          <span class="lb-count">${vol.count} ${translations[currentLang].cleaned_tab.toLowerCase()}</span>
          <span class="lb-points">${vol.points} PTS</span>
        </div>
      </div>
    `;
  });
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
const navBtns = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.panel;
    navBtns.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');

    if (target === 'map') { setTimeout(() => mainMap.invalidateSize(), 50); }
    if (target === 'report') { setTimeout(() => reportMap.invalidateSize(), 50); }
  });
});

// ═══════════════════════════════════════════
// MAP ENGINE
// ═══════════════════════════════════════════
const mainMap = L.map('map', { zoomControl: false }).setView(CENTER, 14);
mainTileLayer = createTileLayer(mainMap, currentMapStyle);
L.control.zoom({ position: 'topright' }).addTo(mainMap);

let mainMarkers = {};
let reportTabMarkers = {};

function createIcon(r) {
  let color = 'var(--color-medium)';
  if (r.status === 'cleaned') color = 'var(--color-cleaned)';
  else if (r.status === 'in-progress') color = 'var(--color-progress)';
  else if (r.severity === 'high') color = 'var(--color-high)';
  else if (r.severity === 'low') color = 'var(--color-low)';

  return L.divIcon({
    className: '',
    html: `<div class="marker-pin" style="color: ${color}"></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14]
  });
}

function generateBeforeAfterHtml(r) {
  if (r.status === 'cleaned' && r.after_photo && r.photo) {
    return `
      <div class="ba-card">
        <div class="ba-img-wrapper">
          <span class="ba-label">Before</span>
          <img class="ba-img" src="${r.photo}" />
        </div>
        <div class="ba-img-wrapper">
          <span class="ba-label">After</span>
          <img class="ba-img" src="${r.after_photo}" />
        </div>
      </div>
    `;
  } else if (r.photo) {
    return `<img class="popup-img" src="${r.photo}" alt="Report photo" />`;
  }
  return '';
}

function popupContent(r) {
  const photoHtml = generateBeforeAfterHtml(r);
  const dateStr = new Date(r.created_at || r.date).toLocaleDateString();
  
  let actions = '';
  const t = translations[currentLang];
  if (r.status === 'reported') {
    actions = `<button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="claimReport('${r.id}')"><i class="ph ph-handshake"></i> ${t.claim_task}</button>`;
  } else if (r.status === 'in-progress') {
    actions = `<button class="btn btn-secondary btn-block" style="margin-top:12px;" onclick="triggerProofModal('${r.id}')"><i class="ph ph-camera-plus"></i> ${t.upload_proof_btn}</button>`;
  }

  let volHtml = '';
  if (r.volunteer) {
    let pts = volunteerScores[r.volunteer] ? volunteerScores[r.volunteer].points : 0;
    volHtml = `<br/><span style="color:var(--color-progress);font-weight:600;">👤 ${r.volunteer} <span style="font-size:0.75rem;background:rgba(59,130,246,0.1);padding:1px 4px;border-radius:4px;">(${pts} pts)</span></span>`;
  }

  const sevLabel = t[r.severity] || r.severity;
  const statusLabel = t[`${r.status}_tab`] || r.status;

  return `
    ${photoHtml}
    <div class="popup-title">${r.title}</div>
    <div class="popup-loc"><i class="ph ph-map-pin"></i> ${r.location}</div>
    <div class="popup-desc">${r.description || 'No description provided.'}</div>
    <div>
      <span class="badge sev-${r.severity}"><span class="badge-dot"></span> ${sevLabel}</span>
      <span class="status-pill ${r.status}" style="float:right;">${statusLabel}</span>
    </div>
    ${actions}
    <div class="popup-footer">${t.filed_by} ${r.reporter} ${t.on} ${dateStr}${volHtml}</div>
  `;
}

function renderMapMarkers() {
  Object.values(mainMarkers).forEach(m => mainMap.removeLayer(m));
  mainMarkers = {};

  if (typeof reportMap !== 'undefined' && reportMap) {
    Object.values(reportTabMarkers).forEach(m => reportMap.removeLayer(m));
    reportTabMarkers = {};
  }

  reports.forEach(r => {
    const mainMarker = L.marker([r.lat, r.lng], { icon: createIcon(r) })
      .bindPopup(popupContent(r), { className: 'custom-popup' }).addTo(mainMap);
    mainMarkers[r.id] = mainMarker;

    if (typeof reportMap !== 'undefined' && reportMap) {
      const rmMarker = L.marker([r.lat, r.lng], { icon: createIcon(r), opacity: 0.6 })
        .bindPopup(popupContent(r), { className: 'custom-popup' }).addTo(reportMap);
      reportTabMarkers[r.id] = rmMarker;
    }
  });
}

// ═══════════════════════════════════════════
// USER LOCATION (GPS) — shared by main map,
// locate button and the report form's "Use GPS"
// ═══════════════════════════════════════════
let userMarker = null, userAccuracy = null;

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });
  });
}

function showUserOnMap(coords, { flyTo = true } = {}) {
  const latlng = [coords.latitude, coords.longitude];

  // Pulsing blue dot
  const icon = L.divIcon({
    className: '',
    html: '<div class="user-dot"><span></span></div>',
    iconSize: [20, 20], iconAnchor: [10, 10]
  });
  if (userMarker) {
    userMarker.setLatLng(latlng);
  } else {
    userMarker = L.marker(latlng, { icon, zIndexOffset: 2000, interactive: false }).addTo(mainMap);
  }

  // Accuracy halo circle
  if (userAccuracy) {
    userAccuracy.setLatLng(latlng);
    userAccuracy.setRadius(coords.accuracy || 50);
  } else {
    userAccuracy = L.circle(latlng, {
      radius: coords.accuracy || 50,
      color: '#3b82f6', weight: 1,
      fillColor: '#3b82f6', fillOpacity: 0.12
    }).addTo(mainMap);
  }

  if (flyTo) mainMap.flyTo(latlng, 15, { duration: 1.2 });
}

async function locateMe(flyTo = true) {
  try {
    const pos = await getUserLocation();
    showUserOnMap(pos.coords, { flyTo });
    return pos;
  } catch (err) {
    console.warn('Geolocation failed:', err.message);
    showToast(false, translations[currentLang].loc_fail);
    return null;
  }
}

// Locate-me button on the main map
document.getElementById('locate-btn').addEventListener('click', () => locateMe(true));

// "Use GPS" in the report form (delegated — the button gets re-created
// via innerHTML after each submission, so a direct listener would die)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#geo-btn');
  if (!btn) return;
  const pos = await locateMe(false);
  if (pos && reportMap) {
    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    reportMap.setView(latlng, 16);
    // Reuse the existing map-click handler to drop the report pin
    reportMap.fireEvent('click', { latlng });
  }
});

// ═══════════════════════════════════════════
// API INTERACTIONS (Claims & Clean)
// ═══════════════════════════════════════════
window.claimReport = async function(id) {
  // Signed-in users claim under their identity; guests fall back to a prompt
  let volName;
  if (currentUser) {
    volName = currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Volunteer';
  } else {
    volName = prompt(translations[currentLang].enter_vol_name, "John D.");
    if (!volName) return;
  }
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteer: volName.trim(), user_id: currentUser?.id || null })
    });
    if ((await res.json()).success) showToast(true, translations[currentLang].in_progress_tab + '...');
  } catch(e) {}
};

// Modals Setup
let targetCleanId = null;

window.triggerProofModal = function(id) {
  targetCleanId = id;
  document.getElementById('proof-modal').style.display = 'flex';
};

document.getElementById('close-proof-modal').addEventListener('click', () => {
  document.getElementById('proof-modal').style.display = 'none';
  targetCleanId = null;
  document.getElementById('after-photo').value = '';
  document.getElementById('after-preview').style.display = 'none';
});

document.getElementById('submit-proof-btn').addEventListener('click', async () => {
  const photoFile = document.getElementById('after-photo').files[0];
  if (!photoFile) {
    alert("An 'After' photo is absolutely required to prove this spot is clean.");
    return;
  }

  const btn = document.getElementById('submit-proof-btn');
  btn.disabled = true;
  btn.textContent = "Uploading...";

  const photoBase64 = await compressImage(photoFile, 800);

  try {
    const res = await fetch(`${API_BASE}/reports/${targetCleanId}/clean`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afterPhotoBase64: photoBase64 })
    });
    const data = await res.json();
    if (data.success) {
      showToast(true, translations[currentLang].proof_accepted || 'Report filed successfully!');
      resetForm();
      // Force immediate local refresh for instant feedback
      refreshAllQuietly();
      document.getElementById('close-proof-modal').click();
    } else {
      showToast(false, `Upload error: ${data.error || 'Check Supabase Keys'}`);
    }
  } catch(e) {
    showToast(false, 'Network failure or file too large.');
  }
  btn.disabled = false;
  btn.textContent = "Submit Proof";
});

// ═══════════════════════════════════════════
// CARDS LIST (Sidebar)
// ═══════════════════════════════════════════
function renderReportCards() {
  const list = document.getElementById('reports-list');
  list.innerHTML = '';
  
  const filtered = reports.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'near-me') {
      if (!nearMeCoords || r.lat == null || r.lng == null) return false;
      return haversineKm(nearMeCoords, [r.lat, r.lng]) <= 2;
    }
    return r.status === activeFilter;
  });
  document.getElementById('report-count').textContent = filtered.length;
  
  if (filtered.length === 0) {
    const emptyIcon = activeFilter === 'near-me' ? 'ph-binoculars' : 'ph-map-pin-area';
    const emptyMsg = activeFilter === 'near-me' ? translations[currentLang].near_me_empty : translations[currentLang].empty_list;
    list.innerHTML = `
      <div class="empty-state">
        <i class="ph ${emptyIcon}"></i>
        <p>${emptyMsg}</p>
        ${activeFilter === 'near-me' ? '' : `<button class="btn btn-primary" onclick="document.querySelector('[data-panel=&quot;report&quot;]').click()">${translations[currentLang].new_report}</button>`}
      </div>
    `;
    return;
  }

  filtered.forEach(r => {
    const card = document.createElement('div');
    card.className = 'report-card';
    card.addEventListener('click', () => {
      mainMap.flyTo([r.lat, r.lng], 16, { duration: 1 });
      setTimeout(() => mainMarkers[r.id]?.openPopup(), 600);
    });

    const dateStr = new Date(r.created_at || r.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const t = translations[currentLang];
    
    let btnHtml = '';
    if (r.status === 'reported') {
      btnHtml = `<button class="btn btn-primary btn-action" onclick="event.stopPropagation(); window.claimReport('${r.id}')">${t.claim_task}</button>`;
    } else if (r.status === 'in-progress') {
      btnHtml = `<button class="btn btn-secondary btn-action" onclick="event.stopPropagation(); window.triggerProofModal('${r.id}')">${t.upload_proof_btn}</button>`;
    }

    const sevLabel = t[r.severity] || r.severity;
    const statusLabel = t[`${r.status}_tab`] || r.status;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title">${r.title}</div>
        <div class="badge sev-${r.severity}"><span class="badge-dot"></span>${sevLabel}</div>
      </div>
      <div class="card-loc"><i class="ph ph-map-pin-line"></i> ${r.location}</div>
      <div class="card-meta">
        <span class="status-pill ${r.status}">
          <i class="ph ${r.status === 'cleaned' ? 'ph-check-circle' : 'ph-clock'}"></i>
          ${statusLabel}
        </span>
        <span class="card-date">${dateStr}</span>
      </div>
      ${btnHtml}
    `;
    list.appendChild(card);
  });
}

document.querySelectorAll('.filter-tab[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    nearMeCoords = null;
    document.querySelectorAll('.filter-tab').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderReportCards();
  });
});

// ── Near-Me filter (2 km radius around the user) ──
let nearMeCoords = null;

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

document.getElementById('near-me-tab').addEventListener('click', async () => {
  const tab = document.getElementById('near-me-tab');

  // Toggle off → back to "All"
  if (nearMeCoords) {
    nearMeCoords = null;
    activeFilter = 'all';
    document.querySelectorAll('.filter-tab').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
    renderReportCards();
    return;
  }

  const pos = await locateMe(true);
  if (!pos) return;
  nearMeCoords = [pos.coords.latitude, pos.coords.longitude];
  activeFilter = 'near-me';
  document.querySelectorAll('.filter-tab').forEach(c => c.classList.remove('active'));
  tab.classList.add('active');
  renderReportCards();
});

// SEARCH
const searchInput = document.getElementById('map-search-input');
const searchClear = document.getElementById('search-clear');
let searchTimeout = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'block' : 'none';

  searchTimeout = setTimeout(async () => {
    if (q.length >= 2) await fetchReports({ search: q });
    else await fetchReports();
    renderMapMarkers();
    renderReportCards();
  }, 300);
});

searchClear.addEventListener('click', async () => {
  searchInput.value = ''; searchClear.style.display = 'none';
  refreshAllQuietly();
});

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
async function renderDashboard() {
  const t = translations[currentLang];
  let stats;
  try {
    stats = await (await fetch(`${API_BASE}/stats`)).json();
  } catch (err) {
    document.getElementById('severity-bars').innerHTML = `<div class="empty-state"><i class="ph ph-wifi-slash"></i><p>${t.sev_error}</p></div>`;
    return;
  }
  if (!stats.success) {
    document.getElementById('severity-bars').innerHTML = `<div class="empty-state"><i class="ph ph-wifi-slash"></i><p>${t.sev_error}</p></div>`;
    return;
  }

  const { total, reported, inProgress, cleaned, severity, recentActivity } = stats.data;
  const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(1) : 0;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-title">${t.total_logs}</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--color-medium)">${reported}</div><div class="stat-title">${t.pending_action}</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--color-progress)">${inProgress}</div><div class="stat-title">${t.in_progress_tab}</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--color-cleaned)">${cleaned}</div><div class="stat-title">${t.resolved}</div></div>
  `;

  if (total === 0) {
    document.getElementById('severity-bars').innerHTML = `<div class="empty-state"><i class="ph ph-chart-bar"></i><p>${t.no_activity}</p></div>`;
  } else {
    document.getElementById('severity-bars').innerHTML = `
      <div class="sev-row"><span class="sev-label">${t.high}</span><div class="sev-track"><div class="sev-fill high" style="width:${pct(severity.high)}%"></div></div><span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.high}</span></div>
      <div class="sev-row"><span class="sev-label">${t.medium}</span><div class="sev-track"><div class="sev-fill medium" style="width:${pct(severity.medium)}%"></div></div><span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.medium}</span></div>
      <div class="sev-row"><span class="sev-label">${t.low}</span><div class="sev-track"><div class="sev-fill low" style="width:${pct(severity.low)}%"></div></div><span style="font-size:0.8rem; font-weight:600; width:40px; text-align:right">${severity.low}</span></div>
    `;
  }

  const feed = document.getElementById('activity-feed');
  if (recentActivity && recentActivity.length > 0) {
    feed.innerHTML = recentActivity.map(a => {
      let icon = a.action === 'created' ? 'ph-plus' : (a.action === 'claimed' ? 'ph-handshake' : 'ph-check');
      const actionLabel = t[`${a.action}_confirmed`] || t[`new_report_filed`] || a.action;
      return `
        <div class="activity-item">
          <div class="act-icon"><i class="ph ${icon}"></i></div>
          <div class="act-body">
            <div class="act-title">${a.report_title}</div>
            <div class="act-desc">${actionLabel}</div>
            <div class="act-time">${new Date(a.created_at).toLocaleString()}</div>
          </div>
        </div>
      `;
    }).join('');
  } else feed.innerHTML = `<div style="text-align:center; padding: 20px 0; color: var(--text-light);">${t.no_activity}</div>`;
}

document.getElementById('refresh-dashboard').addEventListener('click', renderDashboard);

// ═══════════════════════════════════════════
// REPORT FORM + COMPRESSION
// ═══════════════════════════════════════════
const reportMap = L.map('report-map', { zoomControl: false }).setView(CENTER, 14);
reportTileLayer = createTileLayer(reportMap, currentMapStyle);
L.control.zoom({ position: 'topright' }).addTo(reportMap);

let reportPin = null, reportLatLng = null, selectedSeverity = null;

reportMap.on('click', (e) => {
  reportLatLng = e.latlng;
  if (reportPin) reportMap.removeLayer(reportPin);
  reportPin = L.marker(e.latlng, { icon: L.divIcon({ className: '', html: `<div class="marker-pin" style="color: var(--color-progress);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 1000 }).addTo(reportMap);
  const pinBox = document.getElementById('pin-indicator');
  pinBox.classList.add('active');
  pinBox.innerHTML = `<i class="ph-fill ph-map-pin"></i><span>Set to: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</span>`;
  checkFormValidity();
});

document.querySelectorAll('.sev-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.sev-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedSeverity = opt.dataset.sev;
    checkFormValidity();
  });
});

function checkFormValidity() {
  const title = document.getElementById('report-title').value.trim();
  const loc = document.getElementById('report-location').value.trim();
  const t = translations[currentLang];

  // Collect what's still missing so the disabled button explains itself
  const missing = [];
  if (!reportLatLng) missing.push(t.click_map_coords);
  if (!title) missing.push(t.brief_title);
  if (!loc) missing.push(t.landmark);
  if (!selectedSeverity) missing.push(t.severity_class);

  const btn = document.getElementById('submit-report');
  btn.disabled = missing.length > 0;

  const hint = document.getElementById('form-hint');
  if (missing.length > 0) {
    hint.style.display = 'flex';
    hint.innerHTML = `<i class="ph ph-info"></i><span>${t.still_needed} ${missing.join(' · ')}</span>`;
  } else {
    hint.style.display = 'none';
    hint.innerHTML = '';
  }
}

document.getElementById('report-title').addEventListener('input', checkFormValidity);
document.getElementById('report-location').addEventListener('input', checkFormValidity);

function compressImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image(); img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
}

// ── Photo previews (before choosing to upload) ──
document.getElementById('report-photo').addEventListener('change', (e) => {
  const preview = document.getElementById('photo-preview');
  const file = e.target.files[0];
  if (file) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
  else preview.style.display = 'none';
});
document.getElementById('after-photo').addEventListener('change', (e) => {
  const preview = document.getElementById('after-preview');
  const file = e.target.files[0];
  if (file) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
  else preview.style.display = 'none';
});

document.getElementById('submit-report').addEventListener('click', async () => {
  const btn = document.getElementById('submit-report');
  btn.disabled = true; btn.textContent = 'Processing...';

  const photoFile = document.getElementById('report-photo').files[0];
  const photoBase64 = await compressImage(photoFile);

  const reportData = {
    title: document.getElementById('report-title').value.trim(),
    location: document.getElementById('report-location').value.trim(),
    description: document.getElementById('report-desc').value.trim(),
    severity: selectedSeverity,
    lat: reportLatLng.lat, lng: reportLatLng.lng,
    reporter: currentUser
      ? (currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Volunteer')
      : (document.getElementById('report-reporter').value.trim() || 'Anonymous'),
    user_id: currentUser?.id || null,
    photoBase64: photoBase64
  };

  const newReport = await (await fetch(`${API_BASE}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportData) })).json();

  if (newReport.success) {
    document.getElementById('report-title').value = ''; document.getElementById('report-location').value = '';
    document.getElementById('report-desc').value = ''; document.getElementById('report-reporter').value = currentUser ? (displayName() || '') : '';
    document.getElementById('report-photo').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.querySelectorAll('.sev-opt').forEach(o => o.classList.remove('selected'));
    selectedSeverity = null;
    if (reportPin) { reportMap.removeLayer(reportPin); reportPin = null; }
    reportLatLng = null;
    
    document.getElementById('pin-indicator').classList.remove('active');
    document.getElementById('pin-indicator').innerHTML = `<i class="ph ph-map-pin"></i><span>${translations[currentLang].click_map_coords}</span><button class="btn-text" id="geo-btn">${translations[currentLang].use_gps}</button>`;
    
    showToast(true, translations[currentLang].proof_accepted || 'File recorded to global system.');
    document.querySelector('[data-panel="map"]').click();
    // Force immediate local refresh for instant feedback
    refreshAllQuietly();
  } else {
    showToast(false, 'Submission failed');
  }

  btn.disabled = false; btn.textContent = 'Submit into System';
  checkFormValidity();
});

function showToast(success, msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').className = success ? 'ph ph-check-circle' : 'ph ph-warning-circle';
  document.getElementById('toast-icon').style.color = success ? 'var(--color-cleaned)' : 'var(--color-medium)';
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ═══════════════════════════════════════════
// AUTHENTICATION (Supabase Auth)
// ═══════════════════════════════════════════
let authMode = 'signin';

function displayName() {
  if (!currentUser) return null;
  return currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Volunteer';
}

function renderAuthUI() {
  const area = document.getElementById('auth-area');
  if (!area) return;

  if (currentUser) {
    const name = displayName();
    const initial = (name || 'U').charAt(0).toUpperCase();
    area.innerHTML = `
      <div class="user-chip">
        <span class="user-avatar">${initial}</span>
        <div class="user-info">
          <span class="user-name">${name}</span>
          <button class="user-signout" id="signout-btn"><i class="ph ph-sign-out"></i> ${translations[currentLang].sign_out}</button>
        </div>
      </div>`;
    document.getElementById('signout-btn').addEventListener('click', () => sbClient?.auth.signOut());
  } else {
    area.innerHTML = `
      <button class="signin-btn" id="signin-open"><i class="ph ph-sign-in"></i> ${translations[currentLang].sign_in}</button>`;
    document.getElementById('signin-open').addEventListener('click', openAuthModal);
  }

  // Prefill / release the reporter name field on the report form
  const nameInput = document.getElementById('report-reporter');
  if (nameInput) {
    if (currentUser) {
      nameInput.value = displayName();
      nameInput.disabled = true;
    } else {
      nameInput.value = '';
      nameInput.disabled = false;
      nameInput.placeholder = 'Anonymous';
    }
  }
}

function openAuthModal() {
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-modal').style.display = 'flex';
}

document.getElementById('auth-cancel').addEventListener('click', () => {
  document.getElementById('auth-modal').style.display = 'none';
});

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    authMode = tab.dataset.authtab;
    document.getElementById('auth-name-row').style.display = authMode === 'signup' ? 'block' : 'none';
    document.getElementById('auth-submit').textContent =
      authMode === 'signup' ? translations[currentLang].sign_up : translations[currentLang].sign_in;
  });
});

document.getElementById('auth-submit').addEventListener('click', async () => {
  if (!sbClient) return;
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const name = document.getElementById('auth-name').value.trim();
  const errBox = document.getElementById('auth-error');

  if (!email || !pass || (authMode === 'signup' && !name)) {
    errBox.textContent = 'Please fill in all fields.';
    errBox.style.display = 'block';
    return;
  }

  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  const { error } = authMode === 'signup'
    ? await sbClient.auth.signUp({ email, password: pass, options: { data: { name } } })
    : await sbClient.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false;

  if (error) {
    errBox.textContent = error.message;
    errBox.style.display = 'block';
    return;
  }
  errBox.style.display = 'none';
  document.getElementById('auth-modal').style.display = 'none';
  showToast(true, authMode === 'signup'
    ? 'Account created! Check your email to confirm, then sign in.'
    : 'Signed in successfully! 🌱');
});

async function initAuth() {
  if (!sbClient) { renderAuthUI(); return; }
  try {
    const { data } = await sbClient.auth.getSession();
    currentUser = data.session?.user || null;
    renderAuthUI();
    sbClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      renderAuthUI();
    });
  } catch (err) {
    console.warn('Auth init failed:', err.message);
    renderAuthUI();
  }
}

// ── BOOTSTRAP ──
init();
