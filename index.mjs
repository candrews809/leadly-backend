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

// MongoDB setup
const client = new MongoClient(MONGODB_URI);
await client.connect();
console.log("✅ Connected to MongoDB");
const db = client.db("leadly");
const leadsCollection = db.collection("leads");
const usersCollection = db.collection("users");
const businessesCollection = db.collection("businesses");

// Auth helpers
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

// Send email via Resend
async function sendLeadEmail(lead) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Leadly <onboarding@resend.dev>",
      to: NOTIFY_EMAIL,
      subject: `🎯 New Lead: ${lead.name} from ${lead.business || "Unknown Business"}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #00e87a; padding: 20px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #080808; margin: 0; font-size: 24px;">🎯 New Lead Captured!</h1>
          </div>
          <div style="background: #f5f5f5; padding: 24px; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666; width: 140px;">Name</td>
                <td style="padding: 12px 0; font-weight: 600;">${lead.name || "Not provided"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Email</td>
                <td style="padding: 12px 0; font-weight: 600;">
                  <a href="mailto:${lead.email}" style="color: #00b85f;">${lead.email || "Not provided"}</a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Phone</td>
                <td style="padding: 12px 0; font-weight: 600;">${lead.phone || "Not provided"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Business</td>
                <td style="padding: 12px 0; font-weight: 600;">${lead.business || "Not provided"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Message</td>
                <td style="padding: 12px 0; font-weight: 600;">${lead.message || "Not provided"}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666;">Source</td>
                <td style="padding: 12px 0; font-weight: 600;">${lead.url || "Leadly Widget"}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; padding: 16px; background: white; border-radius: 8px; border-left: 4px solid #00e87a;">
              <p style="margin: 0; color: #666; font-size: 14px;">⏰ Captured: ${new Date(lead.timestamp).toLocaleString()}</p>
            </div>
            <div style="margin-top: 16px; text-align: center;">
              <a href="mailto:${lead.email}" style="background: #00e87a; color: #080808; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                Reply to ${lead.name || "Lead"} →
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 16px;">
            Powered by <a href="https://leadly-main.netlify.app" style="color: #00e87a;">Leadly</a>
          </p>
        </div>
      `,
    }),
  });
  const data = await res.json();
  console.log("Email sent:", data);
  return data;
}

async function fireWebhook(webhookUrl, lead) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || '',
        message: lead.message || '',
        business: lead.business || '',
        source: lead.url || 'Leadly',
        timestamp: new Date().toISOString(),
      }),
    });
    console.log('Webhook fired:', webhookUrl);
  } catch (err) {
    console.log('Webhook error:', err.message);
  }
}

async function createCheckoutSession(plan) {
  const priceId = PRICE_IDS[plan] || PRICE_IDS.starter;
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'subscription_data[trial_period_days]': '30',
      'success_url': 'https://leadly-main.netlify.app?success=true',
      'cancel_url': 'https://leadly-main.netlify.app?canceled=true',
    }),
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
<div class="footer">Powered by <a href="https://leadly-main.netlify.app">Leadly</a></div>
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
.logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; }
.logo span { color: #00e87a; }
.logout { color: #888; cursor: pointer; font-size: 14px; background: none; border: none; }
.container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
.welcome { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.subtitle { color: #888; margin-bottom: 40px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 40px; }
.stat-card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; }
.stat-num { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; color: #00e87a; }
.stat-label { color: #888; font-size: 14px; margin-top: 4px; }
.page-url { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; margin-bottom: 40px; }
.page-url h3 { font-family: 'Syne', sans-serif; font-size: 16px; margin-bottom: 12px; }
.url-box { display: flex; gap: 12px; align-items: center; }
.url-text { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; color: #00e87a; font-size: 14px; word-break: break-all; }
.copy-btn { background: #00e87a; color: #000; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.leads-section h3 { font-family: 'Syne', sans-serif; font-size: 20px; margin-bottom: 16px; }
.lead-card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 12px; }
.lead-name { font-weight: 600; margin-bottom: 4px; }
.lead-email { color: #00e87a; font-size: 14px; margin-bottom: 4px; }
.lead-time { color: #666; font-size: 12px; }
.empty { text-align: center; padding: 60px; color: #666; }
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
/* Find Leads styles */
.find-leads-section { margin-top: 8px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
.search-bar input { flex: 1; min-width: 160px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px 16px; border-radius: 8px; font-size: 15px; outline: none; margin-bottom: 0; }
.search-bar input:focus { border-color: rgba(0,232,122,0.4); }
.search-btn { background: #00e87a; color: #000; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; white-space: nowrap; font-size: 15px; }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.result-card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.result-info { flex: 1; }
.result-name { font-weight: 700; font-size: 16px; margin-bottom: 6px; }
.result-address { color: #888; font-size: 13px; margin-bottom: 8px; }
.result-meta { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.result-meta a { color: #00e87a; font-size: 13px; text-decoration: none; }
.result-meta a:hover { text-decoration: underline; }
.result-meta span { color: #666; font-size: 13px; }
.save-lead-btn { background: transparent; border: 1px solid #00e87a; color: #00e87a; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap; font-weight: 600; transition: all .2s; }
.save-lead-btn:hover { background: #00e87a; color: #000; }
.save-lead-btn.saved { background: #00e87a; color: #000; cursor: default; }
.results-header { color: #888; font-size: 13px; margin-bottom: 16px; }
.nav-link { color: #888; font-size: 14px; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; transition: color .2s; }
.nav-link:hover { color: #fff; }
.nav-link.active { color: #00e87a; font-weight: 600; }
.crm-btn { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 13px; font-weight: 600; transition: all .2s; font-family: inherit; }
.crm-btn:hover { border-color: rgba(0,232,122,0.4); color: #fff; background: rgba(0,232,122,0.05); }
.crm-btn.active { border-color: #00e87a; color: #00e87a; background: rgba(0,232,122,0.08); }
</style>
</head>
<body>
<div id="app"></div>
<script>
const API = 'https://leadly-backend-tgbl.onrender.com';
let token = localStorage.getItem('leadly_token');

function render() {
  if (token) { showDashboard(); } else { showLogin(); }
}

function showLogin() {
  document.getElementById('app').innerHTML = \`
    <nav><div class="logo">Lead<span>ly</span></div></nav>
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
  document.getElementById('app').innerHTML = \`
<nav>
  <a href="https://leadly-main.netlify.app" style="text-decoration:none;"><div class="logo">Lead<span>ly</span></div></a>
  <div style="display:flex;gap:20px;align-items:center;">
    <button class="nav-link active" id="nav-leads" onclick="showSection('leads')">My Leads</button>
    <button class="nav-link" id="nav-find" onclick="showSection('find')">Find Leads</button>
    <button class="nav-link" id="nav-integrations" onclick="showSection('integrations')">Integrations</button>
    <a href="https://billing.stripe.com/p/login/eVq6oHaEUd3i27GaGd67S00" target="_blank" style="color:#00e87a;font-size:14px;text-decoration:none;">Manage Subscription</a>
    <button class="logout" onclick="logout()">Sign out</button>
  </div>
</nav>
<div class="container">

  <!-- MY LEADS SECTION -->
  <div id="section-leads">
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
    </div>
    <div class="page-url">
      <h3>Your lead capture page</h3>
      <div class="url-box">
        <div class="url-text">\${data.pageUrl}</div>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('\${data.pageUrl}').then(()=>alert('Copied!'))">Copy</button>
        <a href="\${data.pageUrl}" target="_blank"><button class="copy-btn" style="background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,0.2)">Visit</button></a>
      </div>
    </div>
    <div class="leads-section">
      <h3>Recent leads</h3>
      \${data.leads.length === 0
        ? '<div class="empty">No leads yet. Share your page to start capturing leads!</div>'
        : data.leads.map(l => \`<div class="lead-card"><div class="lead-name">\${l.name || 'Unknown'}</div><div class="lead-email">\${l.email || ''}</div>\${l.phone ? '<div class="lead-time">📞 ' + l.phone + '</div>' : ''}<div class="lead-time">\${new Date(l.timestamp || Date.now()).toLocaleDateString()}</div></div>\`).join('')}
    </div>
  </div>

  <!-- INTEGRATIONS SECTION -->
  <div id="section-integrations" style="display:none">
    <div class="welcome">Integrations</div>
    <p class="subtitle" style="margin-bottom:32px">Connect your CRM — every new lead will be sent there automatically.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      <button class="crm-btn" id="crm-salesforce" onclick="selectCRM('salesforce')">Salesforce</button>
      <button class="crm-btn" id="crm-hubspot" onclick="selectCRM('hubspot')">HubSpot</button>
      <button class="crm-btn" id="crm-ghl" onclick="selectCRM('ghl')">GoHighLevel</button>
      <button class="crm-btn" id="crm-zapier" onclick="selectCRM('zapier')">Zapier</button>
      <button class="crm-btn" id="crm-custom" onclick="selectCRM('custom')">Custom Webhook</button>
    </div>
    <div id="crm-instructions" style="display:none;background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px">
      <h3 id="crm-title" style="font-family:'Syne',sans-serif;font-size:18px;margin-bottom:12px"></h3>
      <p id="crm-instruction-text" style="color:#aaa;font-size:14px;line-height:1.7;margin-bottom:20px"></p>
      <div class="url-box">
        <input type="text" id="webhookInput" placeholder="Paste your webhook URL here..." style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:10px 14px;border-radius:8px;font-size:14px;margin-bottom:0">
        <button class="copy-btn" onclick="saveWebhook()">Save</button>
      </div>
      <p id="webhookStatus" style="color:#00e87a;font-size:13px;margin-top:12px;display:none">✓ Connected!</p>
    </div>
  </div>
  <div id="section-find" style="display:none">
    <div class="welcome">Find Leads 🔍</div>
    <p class="subtitle" style="margin-bottom:32px">Search for local businesses — powered by Google Maps</p>
    <div class="find-leads-section">
      <div class="search-bar">
        <input type="text" id="search-query" placeholder="Business type (e.g. auto repair, dentist, HVAC)">
        <input type="text" id="search-location" placeholder="City or zip (e.g. Austin TX)">
        <button class="search-btn" id="search-btn" onclick="searchLeads()">Search</button>
      </div>
      <div class="results-header" id="results-header" style="display:none"></div>
      <div id="search-results"></div>
    </div>
  </div>

</div>
  \`;
}

function showSection(section) {
  document.getElementById('section-leads').style.display = section === 'leads' ? 'block' : 'none';
  document.getElementById('section-find').style.display = section === 'find' ? 'block' : 'none';
  document.getElementById('section-integrations').style.display = section === 'integrations' ? 'block' : 'none';
  document.getElementById('nav-leads').classList.toggle('active', section === 'leads');
  document.getElementById('nav-find').classList.toggle('active', section === 'find');
  document.getElementById('nav-integrations').classList.toggle('active', section === 'integrations');
}

async function searchLeads() {
  const query = document.getElementById('search-query').value.trim();
  const location = document.getElementById('search-location').value.trim();
  if (!query || !location) { alert('Enter a business type and location'); return; }

  const btn = document.getElementById('search-btn');
  btn.disabled = true; btn.textContent = 'Searching...';
  document.getElementById('search-results').innerHTML = '<p style="color:#888;text-align:center;padding:60px 0">Searching Google Maps...</p>';
  document.getElementById('results-header').style.display = 'none';

  try {
    const res = await fetch(API + '/search-leads?query=' + encodeURIComponent(query) + '&location=' + encodeURIComponent(location), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (data.error) {
      document.getElementById('search-results').innerHTML = '<p style="color:#ff4444;text-align:center;padding:40px 0">Error: ' + data.error + '</p>';
      return;
    }

    document.getElementById('results-header').textContent = data.results.length + ' businesses found';
    document.getElementById('results-header').style.display = 'block';

    if (data.hitCap) {
      const upgrades = { free: 'Starter', starter: 'Pro', pro: 'Agency' };
      const nextPlan = upgrades[data.plan] || 'Pro';
      document.getElementById('results-header').innerHTML =
        data.results.length + ' businesses found <span style="color:#ff9900;margin-left:8px">— You hit your ' + data.plan + ' plan limit of ' + data.maxResults + ' results. <a href="https://leadly-main.netlify.app/pricing" target="_blank" style="color:#00e87a;text-decoration:underline">Upgrade to ' + nextPlan + ' for more →</a></span>';
    }

    if (data.results.length === 0) {
      document.getElementById('search-results').innerHTML = '<div class="empty">No results found. Try a different search.</div>';
      return;
    }

    document.getElementById('search-results').innerHTML = data.results.map((r, i) => \`
      <div class="result-card" id="result-\${i}">
        <div class="result-info">
          <div class="result-name">\${r.name}</div>
          <div class="result-address">📍 \${r.address}</div>
          <div class="result-meta">
            \${r.phone ? '<span>📞 ' + r.phone + '</span>' : '<span style="color:#444">No phone listed</span>'}
            \${r.website ? '<a href="' + r.website + '" target="_blank">🌐 Website</a>' : ''}
            \${r.rating ? '<span>⭐ ' + r.rating + ' (' + r.totalRatings + ' reviews)</span>' : ''}
          </div>
        </div>
        <button class="save-lead-btn" id="save-btn-\${i}" onclick="saveFindLead(\${i}, this)">Save Lead</button>
      </div>
    \`).join('');

    // Store results for save function
    window._searchResults = data.results;

  } catch(err) {
    document.getElementById('search-results').innerHTML = '<p style="color:#ff4444;text-align:center;padding:40px 0">Error: ' + err.message + '</p>';
  } finally {
    btn.disabled = false; btn.textContent = 'Search';
  }
}

async function saveFindLead(i, btn) {
  const r = window._searchResults[i];
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const res = await fetch(API + '/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        name: r.name,
        email: '',
        phone: r.phone || '',
        message: r.address,
        business: r.name,
        url: r.website || '',
        source: 'Google Maps Search'
      })
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = '✓ Saved';
      btn.classList.add('saved');
    } else {
      btn.disabled = false; btn.textContent = 'Save Lead';
    }
  } catch(err) {
    btn.disabled = false; btn.textContent = 'Save Lead';
  }
}

const CRM_INFO = {
  salesforce: {
    label: "Salesforce",
    instructions: "In Salesforce, go to Setup and create a new webhook action via Flow Builder. Or use Zapier Salesforce integration to get a webhook URL that pushes leads directly into Salesforce as new Leads. Paste the webhook URL below.",
    placeholder: "https://hooks.zapier.com/hooks/catch/... (Salesforce via Zapier)"
  },
  hubspot: {
    label: "HubSpot",
    instructions: "In HubSpot, go to Settings and use the Zapier HubSpot integration. Create a webhook that creates a new Contact on trigger. Paste the webhook URL below.",
    placeholder: "https://hooks.zapier.com/hooks/catch/... (HubSpot via Zapier)"
  },
  ghl: {
    label: "GoHighLevel",
    instructions: "In GoHighLevel, go to Settings, then Integrations, then Webhooks. Create a new inbound webhook and copy the URL. Every lead captured in Leadly will be sent there as a new contact.",
    placeholder: "https://services.leadconnectorhq.com/hooks/..."
  },
  zapier: {
    label: "Zapier",
    instructions: "In Zapier, create a new Zap with Webhooks by Zapier as the trigger (Catch Hook). Copy the webhook URL Zapier gives you and paste it below. Then connect it to any app — Google Sheets, Slack, email, and more.",
    placeholder: "https://hooks.zapier.com/hooks/catch/..."
  },
  custom: {
    label: "Custom Webhook",
    instructions: "Paste any webhook URL below. Leadly will POST a JSON payload to it with every new lead: name, email, phone, message, business, source, and timestamp.",
    placeholder: "https://your-server.com/webhook"
  }
};

function selectCRM(crm) {
  document.querySelectorAll('.crm-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('crm-' + crm).classList.add('active');
  const info = CRM_INFO[crm];
  document.getElementById('crm-title').textContent = info.label;
  document.getElementById('crm-instruction-text').textContent = info.instructions;
  document.getElementById('webhookInput').placeholder = info.placeholder;
  document.getElementById('crm-instructions').style.display = 'block';
  document.getElementById('webhookStatus').style.display = 'none';
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
    setTimeout(() => document.getElementById('webhookStatus').style.display = 'none', 3000);
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

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // POST /leads — capture a lead
  if (req.method === "POST" && req.url === "/leads") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const lead = { ...JSON.parse(body), timestamp: new Date().toISOString() };
        console.log("📥 New lead received:", lead);
        await leadsCollection.insertOne(lead);
        console.log("✅ Lead saved to MongoDB");
        await sendLeadEmail(lead);
        const biz = await businessesCollection.findOne({ businessName: lead.business });
        if (biz?.webhookUrl) await fireWebhook(biz.webhookUrl, lead);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Lead captured!" }));
      } catch (err) {
        console.error("Error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /signup
  if (req.method === "POST" && req.url === "/signup") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { name, email, password, businessName } = JSON.parse(body);
        const existing = await usersCollection.findOne({ email });
        if (existing) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email already registered" }));
          return;
        }
        const token = generateToken();
        const slug = businessName ? generateSlug(businessName) : email.split('@')[0];
        await usersCollection.insertOne({ name, email, password: hashPassword(password), token, businessName, slug, createdAt: new Date().toISOString() });
        const existingBiz = await businessesCollection.findOne({ slug });
        if (!existingBiz) {
          await businessesCollection.insertOne({ businessName, slug, city: '', description: '', createdAt: new Date().toISOString() });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token, slug }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /login
  if (req.method === "POST" && req.url === "/login") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { email, password } = JSON.parse(body);
        const user = await usersCollection.findOne({ email });
        if (!user || user.password !== hashPassword(password)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid email or password" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token: user.token, slug: user.slug, name: user.name }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /dashboard (API)
  if (req.method === "GET" && req.url.startsWith("/dashboard") && req.url !== "/dashboard-page") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (!user.token) {
      await usersCollection.updateOne({ email: user.email }, { $set: { token } });
    }
    const myLeads = await leadsCollection
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    const pageUrl = `https://leadly-backend-tgbl.onrender.com/page/${user.slug}`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: user.name, businessName: user.businessName, pageUrl, leadCount: myLeads.length, leads: myLeads }));
    return;
  }

  // GET /dashboard-page (UI)
  if (req.method === "GET" && req.url === "/dashboard-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateDashboardPage());
    return;
  }

  // GET /search-leads?query=auto+repair&location=Austin+TX
  if (req.method === "GET" && req.url.startsWith("/search-leads")) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const urlParams = new URL(req.url, "http://localhost");
    const query = urlParams.searchParams.get("query") || "";
    const location = urlParams.searchParams.get("location") || "";

    // Plan caps
    const plan = user.plan || "free";
    const caps = { free: 50, starter: 150, pro: 250, agency: null };
    const maxResults = caps[plan];

    try {
      const searchQuery = encodeURIComponent(`${query} in ${location}`);
      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${GOOGLE_PLACES_API_KEY}`
      );
      const placesData = await placesRes.json();

      if (placesData.status === "REQUEST_DENIED") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Google Places API key error: " + placesData.error_message }));
        return;
      }

      const results = maxResults === null
        ? (placesData.results || [])
        : (placesData.results || []).slice(0, maxResults);

      const mapped = results.map(p => ({
        name: p.name,
        address: p.formatted_address,
        rating: p.rating || null,
        totalRatings: p.user_ratings_total || 0,
        placeId: p.place_id,
        types: p.types || [],
      }));

      // Fetch phone + website details for each result
      const detailed = await Promise.all(mapped.map(async (r) => {
        try {
          const detailRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${r.placeId}&fields=formatted_phone_number,website&key=${GOOGLE_PLACES_API_KEY}`
          );
          const detailData = await detailRes.json();
          return {
            ...r,
            phone: detailData.result?.formatted_phone_number || null,
            website: detailData.result?.website || null,
          };
        } catch {
          return r;
        }
      }));

      // Check if user hit their cap
      const totalAvailable = (placesData.results || []).length;
      const hitCap = maxResults !== null && totalAvailable > maxResults;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results: detailed, plan, maxResults, hitCap }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /register-business
  if (req.method === "POST" && req.url === "/register-business") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const biz = JSON.parse(body);
        const slug = generateSlug(biz.businessName);
        await businessesCollection.insertOne({ ...biz, slug, createdAt: new Date().toISOString() });
        const pageUrl = `https://leadly-backend-tgbl.onrender.com/page/${slug}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, url: pageUrl, slug }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /page/:slug
  if (req.method === "GET" && req.url.startsWith("/page/")) {
    const slug = req.url.replace("/page/", "");
    const biz = await businessesCollection.findOne({ slug });
    if (!biz) {
      res.writeHead(404);
      res.end("Page not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateLandingPage(biz));
    return;
  }

  // POST /checkout
  if (req.method === "POST" && req.url === "/checkout") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { plan } = JSON.parse(body);
        const session = await createCheckoutSession(plan);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ url: session.url }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /init-business
  if (req.method === "GET" && req.url.startsWith("/init-business/")) {
    const slug = req.url.replace("/init-business/", "");
    const user = await usersCollection.findOne({ slug });
    if (!user) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "User not found" }));
      return;
    }
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

  // GET /health
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Leadly Lead API", db: "MongoDB" }));
    return;
  }

  // POST /update-business
  if (req.method === "POST" && req.url === "/update-business") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { slug, webhookUrl } = JSON.parse(body);
        await businessesCollection.updateOne({ slug }, { $set: { webhookUrl } });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /save-webhook
  if (req.method === "POST" && req.url === "/save-webhook") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { webhookUrl } = JSON.parse(body);
        await businessesCollection.updateOne(
          { slug: user.slug },
          { $set: { webhookUrl } }
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
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
