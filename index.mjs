// Leadly Lead Notification Backend
import { createHmac, randomBytes } from "crypto";
import { createServer } from "http";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const NOTIFY_EMAIL = "sfgiants4cole@gmail.com";
const PORT = process.env.PORT || 3000;

const PRICE_IDS = {
  starter: 'price_1TTCAsD9M5I52vZq3tu7za1b',
  pro: 'price_1TTCCyD9M5I52vZqYTNu6boC',
  agency: 'price_1TTCEQD9M5I52vZq9BSth9uA',
};

const PLAN_SEARCH_CAPS = { free: 50, starter: 150, pro: 250, agency: Infinity };

const client = new MongoClient(MONGODB_URI);
await client.connect();
console.log("✅ Connected to MongoDB");
const db = client.db("leadly");
const leadsCollection = db.collection("leads");
const usersCollection = db.collection("users");
const businessesCollection = db.collection("businesses");

function hashPassword(password) {
  return createHmac('sha256', 'leadly-secret').update(password).digest('hex');
}
function generateToken() {
  return randomBytes(32).toString('hex');
}
async function getUserFromToken(token) {
  return await usersCollection.findOne({ token });
}
function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function sendLeadEmail(lead) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Leadly <onboarding@resend.dev>",
      to: NOTIFY_EMAIL,
      subject: `🎯 New Lead: ${lead.name} from ${lead.business || "Unknown Business"}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;"><div style="background:#00e87a;padding:20px;border-radius:12px 12px 0 0;"><h1 style="color:#080808;margin:0;font-size:24px;">🎯 New Lead Captured!</h1></div><div style="background:#f5f5f5;padding:24px;border-radius:0 0 12px 12px;"><table style="width:100%;border-collapse:collapse;"><tr style="border-bottom:1px solid #e0e0e0;"><td style="padding:12px 0;color:#666;width:140px;">Name</td><td style="padding:12px 0;font-weight:600;">${lead.name || "Not provided"}</td></tr><tr style="border-bottom:1px solid #e0e0e0;"><td style="padding:12px 0;color:#666;">Email</td><td style="padding:12px 0;font-weight:600;"><a href="mailto:${lead.email}" style="color:#00b85f;">${lead.email || "Not provided"}</a></td></tr><tr style="border-bottom:1px solid #e0e0e0;"><td style="padding:12px 0;color:#666;">Phone</td><td style="padding:12px 0;font-weight:600;">${lead.phone || "Not provided"}</td></tr><tr><td style="padding:12px 0;color:#666;">Source</td><td style="padding:12px 0;font-weight:600;">${lead.url || "Leadly Widget"}</td></tr></table><div style="margin-top:16px;text-align:center;"><a href="mailto:${lead.email}" style="background:#00e87a;color:#080808;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Reply to ${lead.name || "Lead"} →</a></div></div></div>`,
    }),
  });
  return res.json();
}

async function fireWebhook(webhookUrl, lead) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: lead.name, email: lead.email, phone: lead.phone || '', message: lead.message || '', business: lead.business || '', source: lead.url || 'Leadly', timestamp: new Date().toISOString() }),
    });
  } catch (err) { console.log('Webhook error:', err.message); }
}

async function createCheckoutSession(plan, userEmail) {
  const priceId = PRICE_IDS[plan] || PRICE_IDS.starter;
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'payment_method_types[]': 'card', 'mode': 'subscription', 'line_items[0][price]': priceId, 'line_items[0][quantity]': '1', 'subscription_data[trial_period_days]': '30', ...(userEmail ? { 'customer_email': userEmail } : {}), 'success_url': 'https://useleadly.io?success=true', 'cancel_url': 'https://useleadly.io/pricing' }),
  });
  return res.json();
}

function generateLandingPage(biz) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${biz.businessName} | Get a Free Quote</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
.hero { padding: 60px 24px; text-align: center; }
.badge { display: inline-block; background: rgba(0,232,122,0.1); color: #00e87a; padding: 6px 16px; border-radius: 100px; font-size: 13px; margin-bottom: 24px; }
h1 { font-size: clamp(28px, 5vw, 48px); font-weight: 800; margin-bottom: 16px; }
h1 span { color: #00e87a; }
.subtitle { color: #999; font-size: 18px; margin-bottom: 16px; }
.location { color: #666; font-size: 15px; margin-bottom: 40px; }
.card { max-width: 500px; margin: 0 auto; background: #111; border: 1px solid #222; border-radius: 24px; padding: 40px; }
.card h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.card p { color: #999; margin-bottom: 24px; }
input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid #333; color: #fff; padding: 14px 18px; border-radius: 8px; font-size: 15px; margin-bottom: 12px; outline: none; }
input:focus { border-color: rgba(0,232,122,0.4); }
input::placeholder { color: #666; }
button { width: 100%; background: #00e87a; color: #000; border: none; padding: 16px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
button:hover { background: #00c96a; }
.success { display: none; text-align: center; padding: 20px; }
.footer { text-align: center; padding: 24px; color: #444; font-size: 13px; }
.footer a { color: #00e87a; text-decoration: none; }
</style>
</head>
<body>
<div class="hero">
  <div class="badge">⚡ Fast Response Guaranteed</div>
  <h1>${biz.businessName}<br><span>Get a Free Quote</span></h1>
  <p class="subtitle">${biz.description || ''}</p>
  <p class="location">📍 ${biz.city || ''}</p>
  <div class="card">
    <h2>Request a Free Quote</h2>
    <p>Fill out the form and we'll get back to you within 24 hours.</p>
    <div id="leadForm">
      <input type="text" id="name" placeholder="Your name" required>
      <input type="email" id="email" placeholder="Email address" required>
      <input type="tel" id="phone" placeholder="Phone number">
      <input type="text" id="message" placeholder="What do you need help with?">
      <button onclick="submitLead()">Get My Free Quote →</button>
    </div>
    <div class="success" id="success">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <h3>Request Sent!</h3>
      <p>We'll be in touch within 24 hours.</p>
    </div>
  </div>
</div>
<div class="footer">Powered by <a href="https://useleadly.io">Leadly</a></div>
<script>
async function submitLead() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  if (!name || !email) { alert('Please fill in your name and email!'); return; }
  await fetch('https://leadly-backend-tgbl.onrender.com/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone: document.getElementById('phone').value, message: document.getElementById('message').value, business: '${biz.businessName}', url: window.location.href })
  });
  document.getElementById('leadForm').style.display = 'none';
  document.getElementById('success').style.display = 'block';
}
</script>
</body>
</html>`;
}

function generateDashboardPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Leadly Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DM Sans', sans-serif; background: #080808; color: #f5f5f0; min-height: 100vh; }
nav { padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
.logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; text-decoration: none; color: inherit; }
.logo span { color: #00e87a; }
.nav-link { color: #00e87a; font-size: 14px; text-decoration: none; cursor: pointer; background: none; border: none; font-family: inherit; }
.logout { color: #888; cursor: pointer; font-size: 14px; background: none; border: none; }
.container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
.welcome { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.subtitle { color: #888; margin-bottom: 40px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 40px; }
.stat-card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; }
.stat-num { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; color: #00e87a; }
.stat-label { color: #888; font-size: 14px; margin-top: 4px; }
.page-url { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
.page-url h3 { font-family: 'Syne', sans-serif; font-size: 16px; margin-bottom: 12px; }
.url-box { display: flex; gap: 12px; align-items: center; }
.url-text { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; color: #00e87a; font-size: 14px; word-break: break-all; }
.copy-btn { background: #00e87a; color: #000; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; }
/* Tabs */
.section-tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.section-tab { padding: 12px 24px; background: none; border: none; color: #888; font-size: 15px; cursor: pointer; font-family: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.section-tab.active { color: #00e87a; border-bottom-color: #00e87a; font-weight: 600; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
/* My Leads */
.leads-controls { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 200px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }
.search-input:focus { border-color: rgba(0,232,122,0.4); }
.search-input::placeholder { color: #666; }
.filter-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; cursor: pointer; }
.filter-select option { background: #1a1a1a; }
.lead-card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 12px; }
.lead-name { font-weight: 600; margin-bottom: 4px; }
.lead-email { color: #00e87a; font-size: 14px; margin-bottom: 4px; }
.lead-time { color: #666; font-size: 12px; }
.lead-source { color: #666; font-size: 12px; margin-top: 4px; }
.empty { text-align: center; padding: 60px; color: #666; }
/* Find Leads */
.find-leads-form { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
.find-leads-form h3 { font-family: 'Syne', sans-serif; font-size: 18px; margin-bottom: 6px; }
.find-leads-form p { color: #888; font-size: 14px; margin-bottom: 20px; }
.find-leads-row { display: flex; gap: 12px; flex-wrap: wrap; }
.find-leads-row input { flex: 1; min-width: 180px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px 16px; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; margin-bottom: 0; }
.find-leads-row input:focus { border-color: rgba(0,232,122,0.4); }
.find-leads-row input::placeholder { color: #666; }
.search-btn { background: #00e87a; color: #000; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; white-space: nowrap; }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.prospect-card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.prospect-info .prospect-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
.prospect-info .prospect-address { color: #888; font-size: 13px; margin-bottom: 4px; }
.prospect-info .prospect-phone { color: #00e87a; font-size: 13px; margin-bottom: 4px; }
.prospect-info .prospect-rating { color: #888; font-size: 12px; }
.prospect-actions { display: flex; flex-direction: column; gap: 8px; }
.save-lead-btn { background: #00e87a; color: #000; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; white-space: nowrap; }
.save-lead-btn.saved { background: #1a1a1a; color: #00e87a; border: 1px solid #00e87a; cursor: default; }
.website-btn { background: transparent; color: #888; border: 1px solid rgba(255,255,255,0.1); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap; text-decoration: none; display: inline-block; text-align: center; }
.cap-notice { background: rgba(0,232,122,0.05); border: 1px solid rgba(0,232,122,0.2); border-radius: 8px; padding: 12px 16px; color: #00e87a; font-size: 13px; margin-bottom: 16px; }
/* Login */
.login-box { max-width: 400px; margin: 80px auto; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 40px; }
.login-box h2 { font-family: 'Syne', sans-serif; font-size: 24px; margin-bottom: 8px; }
.login-box p { color: #888; margin-bottom: 24px; font-size: 14px; }
input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px 16px; border-radius: 8px; font-size: 15px; margin-bottom: 12px; outline: none; }
input:focus { border-color: rgba(0,232,122,0.4); }
.btn { width: 100%; background: #00e87a; color: #000; border: none; padding: 14px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; }
.error { color: #ff4444; font-size: 14px; margin-bottom: 12px; }
.tab { display: flex; gap: 12px; margin-bottom: 24px; }
.tab-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #888; cursor: pointer; font-size: 14px; }
.tab-btn.active { background: #00e87a; color: #000; border-color: #00e87a; font-weight: 600; }
/* Modal */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; width: 100%; max-width: 520px; position: relative; }
.modal h2 { font-family: 'Syne', sans-serif; font-size: 22px; margin-bottom: 8px; }
.modal p { color: #888; font-size: 14px; margin-bottom: 28px; }
.modal-close { position: absolute; top: 16px; right: 20px; background: none; border: none; color: #888; font-size: 22px; cursor: pointer; }
.integration-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.int-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.15s; text-align: center; }
.int-card:hover { border-color: #00e87a; background: rgba(0,232,122,0.05); }
.int-card.selected { border-color: #00e87a; background: rgba(0,232,122,0.08); }
.int-name { font-weight: 600; font-size: 14px; }
.int-desc { color: #888; font-size: 12px; margin-top: 4px; }
.webhook-input-section { display: none; margin-top: 16px; }
.webhook-input-section.show { display: block; }
</style>
</head>
<body>
<div id="app"></div>

<!-- Integrations Modal -->
<div class="modal-overlay" id="integrationsModal">
  <div class="modal">
    <button class="modal-close" onclick="closeIntegrations()">✕</button>
    <h2>Integrations</h2>
    <p>Connect Leadly to your CRM. Every new lead will be sent there automatically.</p>
    <div class="integration-grid">
      <div class="int-card" onclick="selectIntegration('salesforce')">
        <div class="int-name">Salesforce</div>
        <div class="int-desc">via Zapier webhook</div>
      </div>
      <div class="int-card" onclick="selectIntegration('hubspot')">
        <div class="int-name">HubSpot</div>
        <div class="int-desc">via Zapier webhook</div>
      </div>
      <div class="int-card" onclick="selectIntegration('ghl')">
        <div class="int-name">GoHighLevel</div>
        <div class="int-desc">via Zapier webhook</div>
      </div>
      <div class="int-card" onclick="selectIntegration('zapier')">
        <div class="int-name">Zapier</div>
        <div class="int-desc">Any Zapier workflow</div>
      </div>
      <div class="int-card" onclick="selectIntegration('custom')" style="grid-column: span 2;">
        <div class="int-name">Custom Webhook</div>
        <div class="int-desc">Send leads to any URL</div>
      </div>
    </div>
    <div class="webhook-input-section" id="webhookInputSection">
      <p id="webhookInstructions" style="color:#aaa;font-size:13px;margin-bottom:12px;"></p>
      <div class="url-box">
        <input type="text" id="webhookInput" placeholder="https://hooks.zapier.com/hooks/catch/..." style="flex:1;margin-bottom:0;">
        <button class="copy-btn" onclick="saveWebhook()">Save</button>
      </div>
      <p id="webhookStatus" style="color:#00e87a;font-size:13px;margin-top:8px;display:none">✓ Integration saved!</p>
    </div>
  </div>
</div>

<script>
const API = 'https://leadly-backend-tgbl.onrender.com';
let token = localStorage.getItem('leadly_token');
let allLeads = [];
let searchCount = 0;
let searchCap = 50;
let savedPlaceIds = new Set();

function render() {
  if (token) { showDashboard(); } else { showLogin(); }
}

function showLogin() {
  document.getElementById('app').innerHTML = \`
    <nav>
      <a href="https://useleadly.io" class="logo">Lead<span>ly</span></a>
    </nav>
    <div class="container">
      <div class="login-box">
        <h2>Welcome back</h2>
        <p>Sign in to your Leadly dashboard</p>
        <div class="tab">
          <button class="tab-btn active" onclick="showTab('login')">Login</button>
          <button class="tab-btn" onclick="showTab('signup')">Sign up</button>
        </div>
        <div id="login-form">
          <div id="error" class="error" style="display:none"></div>
          <input type="email" id="email" placeholder="Email address">
          <input type="password" id="password" placeholder="Password">
          <button class="btn" onclick="login()">Sign in</button>
        </div>
        <div id="signup-form" style="display:none">
          <div id="error2" class="error" style="display:none"></div>
          <input type="text" id="signup-name" placeholder="Your name">
          <input type="text" id="signup-biz" placeholder="Business name">
          <input type="email" id="signup-email" placeholder="Email address">
          <input type="password" id="signup-password" placeholder="Password">
          <button class="btn" onclick="signup()">Create account</button>
        </div>
      </div>
    </div>
  \`;
}

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (tab==='login'&&i===0)||(tab==='signup'&&i===1)));
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const res = await fetch(API + '/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password}) });
  const data = await res.json();
  if (data.token) { token = data.token; localStorage.setItem('leadly_token', token); render(); }
  else { document.getElementById('error').textContent = data.error; document.getElementById('error').style.display = 'block'; }
}

async function signup() {
  const name = document.getElementById('signup-name').value;
  const businessName = document.getElementById('signup-biz').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const res = await fetch(API + '/signup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, email, password, businessName}) });
  const data = await res.json();
  if (data.token) { token = data.token; localStorage.setItem('leadly_token', token); render(); }
  else { document.getElementById('error2').textContent = data.error; document.getElementById('error2').style.display = 'block'; }
}

async function showDashboard() {
  const res = await fetch(API + '/dashboard', { headers: {'Authorization': 'Bearer ' + token} });
  if (res.status === 401) { token = null; localStorage.removeItem('leadly_token'); render(); return; }
  const data = await res.json();
  allLeads = data.leads;
  searchCap = { free: 50, starter: 150, pro: 250, agency: 99999 }[data.plan || 'free'] || 50;

  document.getElementById('app').innerHTML = \`
    <nav>
      <a href="https://useleadly.io" class="logo">Lead<span>ly</span></a>
      <div style="display:flex;gap:16px;align-items:center;">
        <button class="nav-link" onclick="openIntegrations()">Integrations</button>
        <a href="https://billing.stripe.com/p/login/eVq6oHaEUd3i27GaGd67S00" target="_blank" class="nav-link">Manage Subscription</a>
        <button class="logout" onclick="logout()">Sign out</button>
      </div>
    </nav>
    <div class="container">
      <div class="welcome">Welcome back, \${data.name} 👋</div>
      <p class="subtitle">\${data.businessName}</p>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-num">\${data.leadCount}</div>
          <div class="stat-label">Total leads captured</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">\${data.leads.length > 0 ? 'Active' : 'Waiting'}</div>
          <div class="stat-label">Page status</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="text-transform:capitalize">\${data.plan || 'Free'}</div>
          <div class="stat-label">Current plan</div>
        </div>
      </div>
      <div class="page-url">
        <h3>Your lead capture page</h3>
        <div class="url-box">
          <div class="url-text">\${data.pageUrl}</div>
          <button class="copy-btn" onclick="navigator.clipboard.writeText('\${data.pageUrl}').then(()=>alert('Copied!'))">Copy</button>
          <a href="\${data.pageUrl}" target="_blank"><button class="copy-btn" style="background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,0.2)">Visit</button></a>
        </div>
      </div>

      <div class="section-tabs">
        <button class="section-tab active" onclick="switchTab('my-leads')">My Leads</button>
        <button class="section-tab" onclick="switchTab('find-leads')">Find Leads</button>
      </div>

      <!-- My Leads Tab -->
      <div id="tab-my-leads" class="tab-panel active">
        <div class="leads-controls">
          <input class="search-input" type="text" id="leadSearch" placeholder="Search by name, email, or phone..." oninput="filterLeads()">
          <select class="filter-select" id="sortFilter" onchange="filterLeads()">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div id="leadsContainer">
          \${renderLeadCards(data.leads)}
        </div>
      </div>

      <!-- Find Leads Tab -->
      <div id="tab-find-leads" class="tab-panel">
        <div class="find-leads-form">
          <h3>Find Leads</h3>
          <p>Search for businesses by type and location. Save them directly to your leads.</p>
          <div class="find-leads-row">
            <input type="text" id="bizType" placeholder="Business type (e.g. auto shop, dentist, plumber)">
            <input type="text" id="bizLocation" placeholder="City, State (e.g. Dallas, TX)">
            <button class="search-btn" id="searchBtn" onclick="searchLeads()">Search</button>
          </div>
        </div>
        <div id="searchCapNotice" class="cap-notice" style="display:none"></div>
        <div id="prospectResults"></div>
      </div>
    </div>
  \`;
}

function switchTab(tab) {
  document.querySelectorAll('.section-tab').forEach((b, i) => {
    b.classList.toggle('active', (tab === 'my-leads' && i === 0) || (tab === 'find-leads' && i === 1));
  });
  document.getElementById('tab-my-leads').classList.toggle('active', tab === 'my-leads');
  document.getElementById('tab-find-leads').classList.toggle('active', tab === 'find-leads');
}

function renderLeadCards(leads) {
  if (leads.length === 0) return '<div class="empty">No leads found.</div>';
  return leads.map(l => \`
    <div class="lead-card">
      <div class="lead-name">\${l.name || 'Unknown'}</div>
      <div class="lead-email">\${l.email || ''}</div>
      \${l.phone ? '<div class="lead-time">📞 ' + l.phone + '</div>' : ''}
      \${l.message ? '<div class="lead-time">💬 ' + l.message + '</div>' : ''}
      \${l.url ? '<div class="lead-source">🌐 ' + l.url + '</div>' : ''}
      <div class="lead-time">\${new Date(l.timestamp || Date.now()).toLocaleDateString()}</div>
    </div>
  \`).join('');
}

function filterLeads() {
  const search = document.getElementById('leadSearch').value.toLowerCase();
  const sort = document.getElementById('sortFilter').value;
  let filtered = allLeads.filter(l =>
    !search ||
    (l.name || '').toLowerCase().includes(search) ||
    (l.email || '').toLowerCase().includes(search) ||
    (l.phone || '').toLowerCase().includes(search) ||
    (l.message || '').toLowerCase().includes(search)
  );
  if (sort === 'oldest') filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  else filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  document.getElementById('leadsContainer').innerHTML = renderLeadCards(filtered);
}

async function searchLeads() {
  const bizType = document.getElementById('bizType').value.trim();
  const bizLocation = document.getElementById('bizLocation').value.trim();
  if (!bizType || !bizLocation) { alert('Please enter a business type and location.'); return; }

  if (searchCount >= searchCap) {
    document.getElementById('searchCapNotice').style.display = 'block';
    document.getElementById('searchCapNotice').textContent = 'You have reached your search limit for this plan. Upgrade to search more leads.';
    return;
  }

  const btn = document.getElementById('searchBtn');
  btn.disabled = true;
  btn.textContent = 'Searching...';
  document.getElementById('prospectResults').innerHTML = '<div class="empty">Searching for leads...</div>';

  try {
    const res = await fetch(\`\${API}/search-leads?type=\${encodeURIComponent(bizType)}&location=\${encodeURIComponent(bizLocation)}\`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    searchCount++;

    const capNotice = document.getElementById('searchCapNotice');
    capNotice.style.display = 'block';
    capNotice.textContent = \`\${searchCount} of \${searchCap} searches used this month.\`;

    if (!data.results || data.results.length === 0) {
      document.getElementById('prospectResults').innerHTML = '<div class="empty">No results found. Try a different search.</div>';
    } else {
      document.getElementById('prospectResults').innerHTML = data.results.map(p => \`
        <div class="prospect-card">
          <div class="prospect-info">
            <div class="prospect-name">\${p.name}</div>
            <div class="prospect-address">📍 \${p.address || 'Address not available'}</div>
            \${p.phone ? '<div class="prospect-phone">📞 ' + p.phone + '</div>' : ''}
            \${p.rating ? '<div class="prospect-rating">⭐ ' + p.rating + ' (' + (p.reviews || 0) + ' reviews)</div>' : ''}
          </div>
          <div class="prospect-actions">
            <button class="save-lead-btn" id="save-\${p.place_id}" onclick="saveLead('\${p.place_id}', '\${p.name.replace(/'/g,"\\\\'")}', '\${(p.phone||'').replace(/'/g,"\\\\'")}', '\${(p.address||'').replace(/'/g,"\\\\'")}')">
              \${savedPlaceIds.has(p.place_id) ? '✓ Saved' : 'Save Lead'}
            </button>
            \${p.website ? '<a class="website-btn" href="' + p.website + '" target="_blank">Website</a>' : ''}
          </div>
        </div>
      \`).join('');
    }
  } catch (err) {
    document.getElementById('prospectResults').innerHTML = '<div class="empty">Search failed. Please try again.</div>';
  }

  btn.disabled = false;
  btn.textContent = 'Search';
}

async function saveLead(placeId, name, phone, address) {
  if (savedPlaceIds.has(placeId)) return;
  const btn = document.getElementById('save-' + placeId);
  btn.textContent = 'Saving...';
  try {
    await fetch(API + '/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email: '', message: address, business: name, url: 'Find Leads' })
    });
    savedPlaceIds.add(placeId);
    btn.textContent = '✓ Saved';
    btn.classList.add('saved');
  } catch (err) {
    btn.textContent = 'Save Lead';
  }
}

function openIntegrations() {
  document.getElementById('integrationsModal').classList.add('open');
}

function closeIntegrations() {
  document.getElementById('integrationsModal').classList.remove('open');
  document.querySelectorAll('.int-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('webhookInputSection').classList.remove('show');
}

const instructions = {
  salesforce: 'Create a Zap in Zapier: Trigger = Webhooks by Zapier → Action = Salesforce. Paste the webhook URL below.',
  hubspot: 'Create a Zap in Zapier: Trigger = Webhooks by Zapier → Action = HubSpot. Paste the webhook URL below.',
  ghl: 'Create a Zap in Zapier: Trigger = Webhooks by Zapier → Action = GoHighLevel. Paste the webhook URL below.',
  zapier: 'Create a Zap using "Webhooks by Zapier" as the trigger. Copy the webhook URL and paste it below.',
  custom: 'Paste any webhook URL below. Leadly will POST lead data to it every time a new lead is captured.',
};

function selectIntegration(type) {
  document.querySelectorAll('.int-card').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  document.getElementById('webhookInstructions').textContent = instructions[type];
  document.getElementById('webhookInputSection').classList.add('show');
  document.getElementById('webhookInput').placeholder = 'Paste your webhook URL here...';
}

async function saveWebhook() {
  const webhookUrl = document.getElementById('webhookInput').value;
  if (!webhookUrl) { alert('Please enter a webhook URL'); return; }
  const res = await fetch(API + '/save-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ webhookUrl })
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('webhookStatus').style.display = 'block';
    setTimeout(() => { document.getElementById('webhookStatus').style.display = 'none'; closeIntegrations(); }, 2000);
  }
}

function logout() { token = null; localStorage.removeItem('leadly_token'); render(); }
render();
</script>
</body>
</html>`;
}

// HTTP Server
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.method === "POST" && req.url === "/leads") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const lead = { ...JSON.parse(body), timestamp: new Date().toISOString() };
        await leadsCollection.insertOne(lead);
        await sendLeadEmail(lead);
        const biz = await businessesCollection.findOne({ businessName: lead.business });
        if (biz?.webhookUrl) await fireWebhook(biz.webhookUrl, lead);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Lead captured!" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/signup") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { name, email, password, businessName } = JSON.parse(body);
        const existing = await usersCollection.findOne({ email });
        if (existing) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Email already registered" })); return; }
        const token = generateToken();
        const slug = businessName ? generateSlug(businessName) : email.split('@')[0];
        await usersCollection.insertOne({ name, email, password: hashPassword(password), token, businessName, slug, createdAt: new Date().toISOString() });
        const existingBiz = await businessesCollection.findOne({ slug });
        if (!existingBiz) await businessesCollection.insertOne({ businessName, slug, city: '', description: '', createdAt: new Date().toISOString() });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token, slug }));
      } catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/login") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { email, password } = JSON.parse(body);
        const user = await usersCollection.findOne({ email });
        if (!user || user.password !== hashPassword(password)) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Invalid email or password" })); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token: user.token, slug: user.slug, name: user.name }));
      } catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/dashboard") && req.url !== "/dashboard-page") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    const myLeads = await leadsCollection.find({}).sort({ timestamp: -1 }).limit(100).toArray();
    const pageUrl = `https://leadly-backend-tgbl.onrender.com/page/${user.slug}`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: user.name, businessName: user.businessName, pageUrl, leadCount: myLeads.length, leads: myLeads, plan: user.plan || 'free' }));
    return;
  }

  if (req.method === "GET" && req.url === "/dashboard-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateDashboardPage());
    return;
  }

  // GET /search-leads — Google Places business search
  if (req.method === "GET" && req.url.startsWith("/search-leads")) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }

    const urlObj = new URL(req.url, "http://localhost");
    const type = urlObj.searchParams.get("type") || "";
    const location = urlObj.searchParams.get("location") || "";

    try {
      const query = `${type} in ${location}`;
      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`
      );
      const placesData = await placesRes.json();

      const results = await Promise.all(
        (placesData.results || []).slice(0, 20).map(async (place) => {
          let phone = '';
          let website = '';
          try {
            const detailRes = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_PLACES_API_KEY}`
            );
            const detail = await detailRes.json();
            phone = detail.result?.formatted_phone_number || '';
            website = detail.result?.website || '';
          } catch (e) {}
          return {
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            rating: place.rating,
            reviews: place.user_ratings_total,
            phone,
            website,
          };
        })
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/register-business") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const biz = JSON.parse(body);
        const slug = generateSlug(biz.businessName);
        await businessesCollection.insertOne({ ...biz, slug, createdAt: new Date().toISOString() });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, url: `https://leadly-backend-tgbl.onrender.com/page/${slug}`, slug }));
      } catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/page/")) {
    const slug = req.url.replace("/page/", "");
    const biz = await businessesCollection.findOne({ slug });
    if (!biz) { res.writeHead(404); res.end("Page not found"); return; }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateLandingPage(biz));
    return;
  }

  if (req.method === "POST" && req.url === "/checkout") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { plan } = JSON.parse(body);
        const session = await createCheckoutSession(plan);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ url: session.url }));
      } catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/init-business/")) {
    const slug = req.url.replace("/init-business/", "");
    const user = await usersCollection.findOne({ slug });
    if (!user) { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "User not found" })); return; }
    const existingBiz = await businessesCollection.findOne({ slug });
    if (!existingBiz) {
      await businessesCollection.insertOne({ businessName: user.businessName, slug, city: "", description: "", createdAt: new Date().toISOString() });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Business page created", url: `https://leadly-backend-tgbl.onrender.com/page/${slug}` }));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Business page already exists", url: `https://leadly-backend-tgbl.onrender.com/page/${slug}` }));
    }
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Leadly Lead API", db: "MongoDB" }));
    return;
  }

  if (req.method === "POST" && req.url === "/update-business") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { slug, webhookUrl } = JSON.parse(body);
        await businessesCollection.updateOne({ slug }, { $set: { webhookUrl } });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/stripe-webhook") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        let event;
        try { event = JSON.parse(body); } catch (err) { res.writeHead(400); res.end('Webhook parse error'); return; }
        const PRICE_TO_PLAN = { 'price_1TTCAsD9M5I52vZq3tu7za1b': 'starter', 'price_1TTCCyD9M5I52vZqYTNu6boC': 'pro', 'price_1TTCEQD9M5I52vZq9BSth9uA': 'agency' };
        const subscription = event.data?.object;
        if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
          const priceId = subscription?.items?.data?.[0]?.price?.id;
          const customerId = subscription?.customer;
          const status = subscription?.status;
          const plan = PRICE_TO_PLAN[priceId] || 'free';
          const activePlan = (status === 'active' || status === 'trialing') ? plan : 'free';
          if (customerId) await usersCollection.updateOne({ stripeCustomerId: customerId }, { $set: { plan: activePlan, stripeSubscriptionStatus: status } });
        }
        if (event.type === 'customer.subscription.deleted') {
          const customerId = subscription?.customer;
          if (customerId) await usersCollection.updateOne({ stripeCustomerId: customerId }, { $set: { plan: 'free', stripeSubscriptionStatus: 'canceled' } });
        }
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const customerId = session.customer;
          const customerEmail = session.customer_details?.email || session.customer_email;
          if (customerId && customerEmail) await usersCollection.updateOne({ email: customerEmail }, { $set: { stripeCustomerId: customerId } });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));
      } catch (err) { res.writeHead(500); res.end('Webhook error'); }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/save-webhook") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { webhookUrl } = JSON.parse(body);
        await businessesCollection.updateOne({ slug: user.slug }, { $set: { webhookUrl } });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🎯 Leadly Lead API running on port ${PORT}`);
  console.log(`📧 Sending leads to: ${NOTIFY_EMAIL}`);
});
