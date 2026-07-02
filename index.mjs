// Leadly Backend — MongoDB edition
import { createServer } from "http";
import { createHmac, randomBytes } from "crypto";
import { MongoClient, ObjectId } from "mongodb";

// ─── MongoDB ───────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
let db;

async function getDb() {
  if (db) return db;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db("leadly");
  // indexes
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ token: 1 });
  await db.collection("leads").createIndex({ businessSlug: 1 });
  console.log("✅ MongoDB connected");
  return db;
}

// ─── Auth helpers ──────────────────────────────────────────────────────────
function hashPassword(password) {
  return createHmac("sha256", "leadly-secret").update(password).digest("hex");
}
function generateToken() {
  return randomBytes(32).toString("hex");
}
async function getUserFromToken(token) {
  if (!token) return null;
  const database = await getDb();
  return database.collection("users").findOne({ token });
}

// ─── Slug ──────────────────────────────────────────────────────────────────
function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Stripe ────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_IDS = {
  starter: "price_1TTCAsD9M5I52vZq3tu7za1b",
  pro:     "price_1TTCCyD9M5I52vZqYTNu6boC",
  agency:  "price_1TTCEQD9M5I52vZq9BSth9uA",
};

async function createCheckoutSession(plan, userEmail) {
  const priceId = PRICE_IDS[plan] || PRICE_IDS.starter;
  const params = new URLSearchParams({
    "payment_method_types[]": "card",
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: "https://leadly-backend-tgbl.onrender.com/dashboard-page?success=true",
    cancel_url:  "https://useleadly.io/pricing",
  });
  if (userEmail) params.set("customer_email", userEmail);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return res.json();
}

// ─── Email ─────────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL || "tryleadly@gmail.com";

async function sendLeadEmail(lead, notifyTo) {
  const to = notifyTo || NOTIFY_EMAIL;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Leadly <onboarding@resend.dev>",
      to,
      subject: `🎯 New Lead: ${lead.name} from ${lead.business || "your page"}`,
      html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#00e87a;padding:20px;border-radius:12px 12px 0 0">
    <h1 style="color:#080808;margin:0;font-size:24px">🎯 New Lead Captured!</h1>
  </div>
  <div style="background:#f5f5f5;padding:24px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666;width:140px">Name</td><td style="padding:12px 0;font-weight:600">${lead.name || "—"}</td></tr>
      <tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666">Email</td><td style="padding:12px 0;font-weight:600"><a href="mailto:${lead.email}" style="color:#00b85f">${lead.email || "—"}</a></td></tr>
      <tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666">Phone</td><td style="padding:12px 0;font-weight:600">${lead.phone || "—"}</td></tr>
      <tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666">Message</td><td style="padding:12px 0;font-weight:600">${lead.message || "—"}</td></tr>
      <tr><td style="padding:12px 0;color:#666">Source</td><td style="padding:12px 0;font-weight:600">${lead.url || "Leadly"}</td></tr>
    </table>
    <p style="margin-top:16px;color:#999;font-size:12px">Captured: ${new Date(lead.timestamp || Date.now()).toLocaleString()}</p>
  </div>
</div>`,
    }),
  });
}

async function sendWelcomeEmail(user) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Cole at Leadly <onboarding@resend.dev>",
      to: user.email,
      subject: "Your Leadly page is ready 🎉",
      html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:28px;font-weight:800">Welcome to Leadly, ${user.name}! 👋</h1>
  <p style="color:#555;font-size:16px;margin:16px 0">Your free lead capture page is live and ready to share.</p>
  <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:24px 0">
    <p style="margin:0;font-size:14px;color:#666;margin-bottom:8px">Your lead page URL:</p>
    <a href="https://leadly-backend-tgbl.onrender.com/page/${user.slug}" style="color:#00b85f;font-weight:700;font-size:16px">
      leadly-backend-tgbl.onrender.com/page/${user.slug}
    </a>
  </div>
  <p style="color:#555">Share this link on social media, in your email signature, or anywhere you want leads to come from.</p>
  <a href="https://leadly-backend-tgbl.onrender.com/dashboard-page" style="display:inline-block;background:#00e87a;color:#080808;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">Go to your dashboard →</a>
  <p style="color:#aaa;font-size:12px;margin-top:32px">— Cole at Leadly</p>
</div>`,
    }),
  });
}

// ─── Webhook ───────────────────────────────────────────────────────────────
async function fireWebhook(webhookUrl, lead) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.log("Webhook error:", err.message);
  }
}

// ─── HTML Pages ────────────────────────────────────────────────────────────
function generateSignupPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Get Started Free — Leadly</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#080808;color:#f5f5f0;min-height:100vh;display:flex;flex-direction:column}
nav{padding:20px 40px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;text-decoration:none;color:#f5f5f0}
.logo span{color:#00e87a}
.back{color:#888;text-decoration:none;font-size:14px}
.back:hover{color:#fff}
.main{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 24px}
.box{width:100%;max-width:440px}
.badge{display:inline-block;background:rgba(0,232,122,0.1);color:#00e87a;padding:6px 14px;border-radius:100px;font-size:13px;font-weight:600;margin-bottom:24px}
h1{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;margin-bottom:8px;line-height:1.2}
.sub{color:#888;font-size:15px;margin-bottom:32px}
.tabs{display:flex;gap:8px;margin-bottom:24px;background:rgba(255,255,255,0.05);padding:4px;border-radius:10px}
.tab{flex:1;padding:9px;border-radius:7px;border:none;background:transparent;color:#888;cursor:pointer;font-size:14px;font-family:'DM Sans',sans-serif;transition:all .15s}
.tab.active{background:#00e87a;color:#000;font-weight:700}
.field{margin-bottom:14px}
label{display:block;font-size:13px;color:#888;margin-bottom:6px;font-weight:500}
input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:13px 16px;border-radius:8px;font-size:15px;outline:none;font-family:'DM Sans',sans-serif;transition:border-color .15s}
input:focus{border-color:rgba(0,232,122,0.5)}
input::placeholder{color:#555}
.btn{width:100%;background:#00e87a;color:#000;border:none;padding:15px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;font-family:'DM Sans',sans-serif;transition:background .15s}
.btn:hover{background:#00c96a}
.btn:disabled{opacity:0.6;cursor:not-allowed}
.error{color:#ff5555;font-size:13px;margin-bottom:12px;padding:10px 14px;background:rgba(255,85,85,0.1);border-radius:6px;display:none}
.divider{text-align:center;color:#444;font-size:13px;margin:20px 0;position:relative}
.divider::before,.divider::after{content:'';position:absolute;top:50%;width:42%;height:1px;background:rgba(255,255,255,0.08)}
.divider::before{left:0}.divider::after{right:0}
.trust{display:flex;gap:20px;margin-top:24px;justify-content:center}
.trust-item{display:flex;align-items:center;gap:6px;color:#666;font-size:13px}
.trust-item span{color:#00e87a}
.success-box{text-align:center;padding:40px 20px;display:none}
.success-box h2{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;margin:16px 0 8px}
.success-box p{color:#888;margin-bottom:24px}
.success-box a{display:inline-block;background:#00e87a;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<nav>
  <a href="https://useleadly.io" class="logo">Lead<span>ly</span></a>
  <a href="https://useleadly.io" class="back">← Back to home</a>
</nav>
<div class="main">
  <div class="box">
    <div id="form-section">
      <div class="badge">✨ Free forever — no credit card</div>
      <h1>Get your free lead page</h1>
      <p class="sub">Set up in 60 seconds. Start capturing leads today.</p>

      <div class="tabs">
        <button class="tab active" onclick="switchTab('signup')">Create account</button>
        <button class="tab" onclick="switchTab('login')">Sign in</button>
      </div>

      <div id="error" class="error"></div>

      <!-- SIGNUP -->
      <div id="signup-fields">
        <div class="field"><label>Your name</label><input type="text" id="s-name" placeholder="Jane Smith" autocomplete="name"></div>
        <div class="field"><label>Business name</label><input type="text" id="s-biz" placeholder="Smith Marketing" autocomplete="organization"></div>
        <div class="field"><label>Email</label><input type="email" id="s-email" placeholder="jane@smithmarketing.com" autocomplete="email"></div>
        <div class="field"><label>Password</label><input type="password" id="s-pass" placeholder="At least 8 characters" autocomplete="new-password"></div>
        <button class="btn" id="signup-btn" onclick="doSignup()">Create free account →</button>
        <div class="trust">
          <div class="trust-item"><span>✓</span> No credit card</div>
          <div class="trust-item"><span>✓</span> Free forever</div>
          <div class="trust-item"><span>✓</span> Setup in 60s</div>
        </div>
      </div>

      <!-- LOGIN -->
      <div id="login-fields" style="display:none">
        <div class="field"><label>Email</label><input type="email" id="l-email" placeholder="you@example.com" autocomplete="email"></div>
        <div class="field"><label>Password</label><input type="password" id="l-pass" placeholder="Your password" autocomplete="current-password"></div>
        <button class="btn" id="login-btn" onclick="doLogin()">Sign in →</button>
      </div>
    </div>

    <div class="success-box" id="success-box">
      <div style="font-size:56px">🎉</div>
      <h2>You're in!</h2>
      <p>Taking you to your dashboard…</p>
      <a href="/dashboard-page">Go to dashboard →</a>
    </div>
  </div>
</div>

<script>
const API = 'https://leadly-backend-tgbl.onrender.com';

// If already logged in, skip straight to dashboard
if (localStorage.getItem('leadly_token')) {
  window.location.href = '/dashboard-page';
}

// Pre-fill plan from URL param (e.g. ?plan=pro)
const urlPlan = new URLSearchParams(window.location.search).get('plan');

function switchTab(tab) {
  const isSignup = tab === 'signup';
  document.querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('active', isSignup ? i === 0 : i === 1));
  document.getElementById('signup-fields').style.display = isSignup ? 'block' : 'none';
  document.getElementById('login-fields').style.display  = isSignup ? 'none'  : 'block';
  hideError();
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() { document.getElementById('error').style.display = 'none'; }

async function doSignup() {
  hideError();
  const name         = document.getElementById('s-name').value.trim();
  const businessName = document.getElementById('s-biz').value.trim();
  const email        = document.getElementById('s-email').value.trim();
  const password     = document.getElementById('s-pass').value;

  if (!name || !businessName || !email || !password) { showError('Please fill in all fields.'); return; }
  if (password.length < 8) { showError('Password must be at least 8 characters.'); return; }

  const btn = document.getElementById('signup-btn');
  btn.disabled = true; btn.textContent = 'Creating account…';

  try {
    const res  = await fetch(API + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, businessName, plan: urlPlan || 'free' })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('leadly_token', data.token); if(data.slug) localStorage.setItem('leadly_slug', data.slug);
      if (urlPlan && urlPlan !== 'free') {
        // Kick to Stripe checkout
        const ckRes  = await fetch(API + '/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.token },
          body: JSON.stringify({ plan: urlPlan })
        });
        const ckData = await ckRes.json();
        if (ckData.url) { window.location.href = ckData.url; return; }
      }
      showSuccess();
    } else {
      showError(data.error || 'Something went wrong. Please try again.');
      btn.disabled = false; btn.textContent = 'Create free account →';
    }
  } catch (e) {
    showError('Network error. Please try again.');
    btn.disabled = false; btn.textContent = 'Create free account →';
  }
}

async function doLogin() {
  hideError();
  const email    = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-pass').value;
  if (!email || !password) { showError('Please enter your email and password.'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';

  try {
    const res  = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('leadly_token', data.token);
      showSuccess();
    } else {
      showError(data.error || 'Invalid email or password.');
      btn.disabled = false; btn.textContent = 'Sign in →';
    }
  } catch (e) {
    showError('Network error. Please try again.');
    btn.disabled = false; btn.textContent = 'Sign in →';
  }
}

function showSuccess() {
  document.getElementById('form-section').style.display = 'none';
  document.getElementById('success-box').style.display  = 'block';
  setTimeout(() => { window.location.href = '/dashboard-page'; }, 1500);
}

// Enter key support
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const signupVisible = document.getElementById('signup-fields').style.display !== 'none';
  if (signupVisible) doSignup(); else doLogin();
});
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
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#080808;color:#f5f5f0;min-height:100vh}
nav{padding:16px 40px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;text-decoration:none;color:#f5f5f0}
.logo span{color:#00e87a}
.nav-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.nav-btn{background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:8px 14px;border-radius:7px;font-weight:600;cursor:pointer;font-size:13px;text-decoration:none;display:inline-block;font-family:'DM Sans',sans-serif;transition:background .15s}
.nav-btn:hover{background:rgba(255,255,255,0.1)}
.upgrade-btn{background:#00e87a;color:#000;border:none;padding:8px 14px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif}
.logout{color:#666;cursor:pointer;font-size:13px;background:none;border:none;font-family:'DM Sans',sans-serif}
.logout:hover{color:#fff}
.container{max-width:1200px;margin:0 auto;padding:40px 24px}
.leads-columns{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
@media(max-width:860px){.leads-columns{grid-template-columns:1fr}}
.welcome{font-family:'Syne',sans-serif;font-size:28px;font-weight:700;margin-bottom:4px}
.subtitle{color:#888;margin-bottom:32px}
.plan-badge{display:inline-block;background:rgba(0,232,122,0.1);color:#00e87a;padding:4px 10px;border-radius:100px;font-size:12px;font-weight:600;margin-left:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px}
.stat-card{background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px}
.stat-num{font-family:'DM Sans',sans-serif;font-size:40px;font-weight:700;color:#00e87a;min-height:48px;display:flex;align-items:center}
.stat-label{color:#888;font-size:14px;margin-top:4px}
.section{background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:24px}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.section h3{font-family:'Syne',sans-serif;font-size:16px}
.url-box{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.url-text{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#00e87a;font-size:14px;word-break:break-all;min-width:0}
.btn-sm{background:#00e87a;color:#000;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:13px;font-family:'DM Sans',sans-serif}
.btn-ghost{background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.15);padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:13px;text-decoration:none;display:inline-block}

/* Search */
.search-wrap{position:relative;margin-bottom:16px}
.prospect-search-wrap{display:flex;gap:10px;margin-bottom:16px}
.prospect-search-wrap input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:11px 16px;border-radius:8px;font-size:14px;outline:none;font-family:'DM Sans',sans-serif}
.prospect-search-wrap input:focus{border-color:rgba(0,232,122,0.4)}
.prospect-search-wrap input::placeholder{color:#555}
.search-go{background:#00e87a;color:#000;border:none;padding:11px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;font-family:'DM Sans',sans-serif;white-space:nowrap}
.prospect-card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.prospect-info .p-name{font-weight:600;font-size:15px;margin-bottom:4px}
.prospect-info .p-addr{color:#888;font-size:13px;margin-bottom:2px}
.prospect-info .p-phone{color:#666;font-size:13px}
.add-lead-btn{background:#00e87a;color:#000;border:none;padding:8px 14px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap;font-family:'DM Sans',sans-serif;flex-shrink:0}
.add-lead-btn:disabled{background:#1a4a2e;color:#4a8a5e;cursor:not-allowed}
.prospect-empty{text-align:center;padding:40px;color:#555;font-size:14px}
.searching{text-align:center;padding:30px;color:#888;font-size:14px}
.search-wrap input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:11px 16px 11px 40px;border-radius:8px;font-size:14px;outline:none;font-family:'DM Sans',sans-serif}
.search-wrap input:focus{border-color:rgba(0,232,122,0.4)}
.search-wrap input::placeholder{color:#555}
.search-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#555;font-size:15px}

/* Lead cards */
.lead-card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;margin-bottom:10px;display:flex;gap:16px;align-items:flex-start}
.lead-avatar{width:40px;height:40px;border-radius:50%;background:rgba(0,232,122,0.15);display:flex;align-items:center;justify-content:center;font-weight:700;color:#00e87a;font-size:16px;flex-shrink:0}
.lead-name{font-weight:600;margin-bottom:3px}
.lead-email{color:#00e87a;font-size:14px;margin-bottom:2px}
.lead-meta{color:#666;font-size:12px}
.lead-hidden{display:none}
.empty{text-align:center;padding:60px;color:#555}
.no-results{text-align:center;padding:40px;color:#555;font-size:14px;display:none}

/* Integrations */
.int-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.int-card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-decoration:none;color:#fff;transition:border-color .15s;display:block}
.int-card:hover{border-color:rgba(0,232,122,0.4)}
.int-card-name{font-weight:600;font-size:14px;margin-bottom:4px}
.int-card-desc{color:#666;font-size:12px}
.webhook-row{display:flex;gap:10px;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)}
.webhook-label{font-size:14px;font-weight:600;white-space:nowrap}
input[type=url]{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:9px 13px;border-radius:7px;font-size:14px;outline:none;min-width:0;font-family:'DM Sans',sans-serif}
input[type=url]:focus{border-color:rgba(0,232,122,0.4)}
.save-int{background:#00e87a;color:#000;border:none;padding:9px 16px;border-radius:7px;font-weight:600;cursor:pointer;font-size:13px;white-space:nowrap;font-family:'DM Sans',sans-serif}

.toast{position:fixed;bottom:24px;right:24px;background:#00e87a;color:#000;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1}
</style>
</head>
<body>
<div id="app">
  <nav>
    <a href="https://useleadly.io" class="logo">Lead<span>ly</span></a>
    <div style="color:#00e87a;font-size:14px">Loading…</div>
  </nav>
</div>
<div class="toast" id="toast"></div>

<script>
const API = 'https://leadly-backend-tgbl.onrender.com';
const PORTAL = 'https://billing.stripe.com/p/login/eVq6oHaEUd3i27GaGd67S00';
let token = localStorage.getItem('leadly_token');
let allLeads = [];

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

async function init() {
  if (!token) { window.location.href = '/signup-page'; return; }
  const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 401) { localStorage.removeItem('leadly_token'); window.location.href = '/signup-page'; return; }
  const d = await res.json();
  allLeads = d.leads || [];
  renderDashboard(d);
}

function renderDashboard(d) {
  const leadsHtml = allLeads.length === 0
    ? \`<div class="empty"><p>No leads yet.</p><p style="color:#555;font-size:14px;margin-top:8px">Share your page link to start capturing leads.</p></div>\`
    : allLeads.map((l, i) => {
        const initial = (l.name || '?')[0].toUpperCase();
        return \`<div class="lead-card" data-idx="\${i}">
          <div class="lead-avatar">\${initial}</div>
          <div>
            <div class="lead-name">\${l.name || 'Unknown'}</div>
            <div class="lead-email">\${l.email || ''}</div>
            \${l.phone ? \`<div class="lead-meta">\${l.phone}</div>\` : ''}
            \${l.message ? \`<div class="lead-meta" style="margin-top:4px">\${l.message}</div>\` : ''}
            <div class="lead-meta" style="margin-top:4px">\${new Date(l.timestamp || Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
          </div>
        </div>\`;
      }).join('');

  document.getElementById('app').innerHTML = \`
<nav>
  <a href="https://useleadly.io" class="logo">Lead<span>ly</span></a>
  <div class="nav-right">
    \${d.plan === 'free' ? \`<button class="upgrade-btn" onclick="upgrade()">Upgrade</button>\` : ''}
    <a href="\${PORTAL}" target="_blank" class="nav-btn">Manage Subscription</a>
    <button class="nav-btn" onclick="window.location.href='/integrations-page'">Integrations</button>
    <button class="logout" onclick="logout()">Sign out</button>
  </div>
</nav>
<div class="container">
  <div class="welcome">Welcome back, \${d.name} 👋</div>
  <div class="subtitle">\${d.businessName}<span class="plan-badge">\${(d.plan||'free').toUpperCase()}</span></div>

  <div class="stats">
    <div class="stat-card"><div class="stat-num">\${d.leadCount ?? 0}</div><div class="stat-label">Total leads</div></div>
    <div class="stat-card"><div class="stat-num">\${d.leadsThisMonth ?? 0}</div><div class="stat-label">This month</div></div>
    <div class="stat-card"><div class="stat-num">\${d.cap === 999999 ? '∞' : d.cap}</div><div class="stat-label">Monthly cap</div></div>
  </div>

  <div class="section">
    <h3>Your lead page</h3>
    <div class="url-box" style="margin-top:16px">
      <div class="url-text">\${d.pageUrl}</div>
      <button class="btn-sm" onclick="navigator.clipboard.writeText('\${d.pageUrl}').then(()=>toast('Copied!'))">Copy link</button>
      <a class="btn-ghost" href="\${d.pageUrl}" target="_blank">Visit</a>
    </div>
  </div>

  <div class="leads-columns">
  <div class="section">
    <div class="section-header">
      <h3>Recent leads</h3>
      <span style="color:#555;font-size:13px">\${allLeads.length} total</span>
    </div>
    <div class="search-wrap">
      <span class="search-icon">&#128269;</span>
      <input type="text" placeholder="Filter your leads by name, email, phone..." oninput="searchLeads(this.value)" id="lead-search">
    </div>
    <div id="leads-list">\${leadsHtml}</div>
    <div class="no-results" id="no-results">No leads match your search.</div>
  </div>

  <div class="section">
    <div class="section-header">
      <h3>Find new leads</h3>
      <span style="color:#555;font-size:13px">Search any business type + location</span>
    </div>
    <div class="prospect-search-wrap">
      <input type="text" id="prospect-query" placeholder="e.g. auto repair shops Dallas TX" onkeydown="if(event.key==='Enter')findLeads()">
      <button class="search-go" onclick="findLeads()">Search</button>
    </div>
    <div id="prospect-results"></div>
  </div>
  </div>

</div>\`;
}

function searchLeads(query) {
  const q = query.toLowerCase().trim();
  const cards = document.querySelectorAll('.lead-card');
  let visible = 0;
  cards.forEach((card, i) => {
    const l = allLeads[i];
    const match = !q ||
      (l.name  || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.message || '').toLowerCase().includes(q);
    card.style.display = match ? 'flex' : 'none';
    if (match) visible++;
  });
  document.getElementById('no-results').style.display = visible === 0 && q ? 'block' : 'none';
}

async function saveWebhook() {
  const url = document.getElementById('webhook-url').value.trim();
  await fetch(API + '/settings/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ webhookUrl: url })
  });
  toast('Webhook saved!');
}

async function upgrade() {
  const res  = await fetch(API + '/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ plan: 'pro' })
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

function logout() { localStorage.removeItem('leadly_token'); window.location.href = '/signup-page'; }

async function findLeads() {
  const q = document.getElementById('prospect-query').value.trim();
  if (!q) return;
  const box = document.getElementById('prospect-results');
  box.innerHTML = '<div class="searching">Searching...</div>';
  try {
    const res = await fetch(API + '/search-places?q=' + encodeURIComponent(q), {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      box.innerHTML = '<div class="prospect-empty">No results found. Try a different search.</div>';
      return;
    }
    box.innerHTML = data.results.map((p, i) => {
      const added = allLeads.some(l => l.name === p.name && l.address === p.address);
      return \`<div class="prospect-card">
        <div class="prospect-info">
          <div class="p-name">\${p.name}</div>
          <div class="p-addr">\${p.address || ''}</div>
          \${p.phone ? \`<div class="p-phone">\${p.phone}</div>\` : ''}
          \${p.rating ? \`<div class="p-phone">Rating: \${p.rating}/5</div>\` : ''}
        </div>
        <button class="add-lead-btn" id="add-\${i}" onclick="addProspect(\${i})" \${added ? 'disabled' : ''}>\${added ? 'Added' : 'Add lead'}</button>
      </div>\`;
    }).join('');
    window._prospects = data.results;
  } catch(e) {
    box.innerHTML = '<div class="prospect-empty">Search failed. Please try again.</div>';
  }
}

async function addProspect(i) {
  const p = window._prospects[i];
  const btn = document.getElementById('add-' + i);
  btn.disabled = true; btn.textContent = 'Adding...';
  try {
    await fetch(API + '/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        name: p.name,
        email: '',
        phone: p.phone || '',
        address: p.address || '',
        message: 'Added from lead search',
        businessSlug: localStorage.getItem('leadly_slug') || 'get-leadly',
        source: 'prospect_search'
      })
    });
    btn.textContent = 'Added';
    toast('Lead added!');
    allLeads.unshift({ name: p.name, email: '', phone: p.phone || '', address: p.address, timestamp: new Date() });
    document.getElementById('leads-list').innerHTML = allLeads.map((l, idx) => {
      const initial = (l.name || '?')[0].toUpperCase();
      return \`<div class="lead-card" data-idx="\${idx}">
        <div class="lead-avatar">\${initial}</div>
        <div>
          <div class="lead-name">\${l.name || 'Unknown'}</div>
          <div class="lead-email">\${l.email || ''}</div>
          \${l.phone ? \`<div class="lead-meta">\${l.phone}</div>\` : ''}
          \${l.address ? \`<div class="lead-meta">\${l.address}</div>\` : ''}
          <div class="lead-meta" style="margin-top:4px">\${new Date(l.timestamp || Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
        </div>
      </div>\`;
    }).join('');
  } catch(e) {
    btn.disabled = false; btn.textContent = 'Add lead';
    toast('Failed to add lead');
  }
}

init();
</script>
</body>
</html>`;
}


function generateIntegrationsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Integrations — Leadly</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#080808;color:#f5f5f0;min-height:100vh}
nav{padding:16px 40px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;text-decoration:none;color:#f5f5f0}
.logo span{color:#00e87a}
.nav-right{display:flex;align-items:center;gap:10px}
.nav-btn{background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:8px 14px;border-radius:7px;font-weight:600;cursor:pointer;font-size:13px;text-decoration:none;display:inline-block;font-family:'DM Sans',sans-serif}
.back-btn{color:#888;text-decoration:none;font-size:14px;font-family:'DM Sans',sans-serif}
.back-btn:hover{color:#fff}
.container{max-width:700px;margin:0 auto;padding:40px 24px}
h1{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;margin-bottom:8px}
.subtitle{color:#888;font-size:15px;margin-bottom:40px}
.int-section{background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;margin-bottom:20px}
.int-header{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.int-icon{width:44px;height:44px;border-radius:10px;background:rgba(0,232,122,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.int-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:700}
.int-desc{color:#888;font-size:13px;margin-top:2px}
.field{margin-bottom:14px}
label{display:block;font-size:13px;color:#888;margin-bottom:6px;font-weight:500}
input[type=url],input[type=text]{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:11px 14px;border-radius:8px;font-size:14px;outline:none;font-family:'DM Sans',sans-serif}
input:focus{border-color:rgba(0,232,122,0.4)}
input::placeholder{color:#555}
.save-btn{background:#00e87a;color:#000;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;font-family:'DM Sans',sans-serif;margin-top:4px}
.save-btn:hover{background:#00c96a}
.how-to{background:rgba(255,255,255,0.03);border-radius:8px;padding:14px;margin-top:14px}
.how-to p{font-size:13px;color:#666;line-height:1.6}
.how-to a{color:#00e87a;text-decoration:none}
.toast{position:fixed;bottom:24px;right:24px;background:#00e87a;color:#000;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1}
</style>
</head>
<body>
<nav>
  <a href="https://useleadly.io" class="logo">Lead<span>ly</span></a>
  <div class="nav-right">
    <a href="/dashboard-page" class="back-btn">← Back to dashboard</a>
  </div>
</nav>
<div class="container">
  <h1>Integrations</h1>
  <p class="subtitle">Connect Leadly to your CRM. Every new lead will be sent there automatically.</p>

  <div class="int-section">
    <div class="int-header">
      <div class="int-icon">SF</div>
      <div>
        <div class="int-title">Salesforce</div>
        <div class="int-desc">Send leads directly to your Salesforce CRM</div>
      </div>
    </div>
    <div class="field">
      <label>Salesforce Webhook URL</label>
      <input type="url" id="sf-webhook" placeholder="https://hooks.zapier.com/hooks/catch/…">
    </div>
    <button class="save-btn" onclick="save('salesforce', 'sf-webhook')">Save</button>
    <div class="how-to">
      <p>1. Go to <a href="https://zapier.com" target="_blank">Zapier</a> and create a new Zap<br>
      2. Set trigger to "Webhooks by Zapier" → Catch Hook<br>
      3. Set action to Salesforce → Create Lead<br>
      4. Copy the webhook URL and paste it above</p>
    </div>
  </div>

  <div class="int-section">
    <div class="int-header">
      <div class="int-icon">HS</div>
      <div>
        <div class="int-title">HubSpot</div>
        <div class="int-desc">Send leads directly to your HubSpot CRM</div>
      </div>
    </div>
    <div class="field">
      <label>HubSpot Webhook URL</label>
      <input type="url" id="hs-webhook" placeholder="https://hooks.zapier.com/hooks/catch/…">
    </div>
    <button class="save-btn" onclick="save('hubspot', 'hs-webhook')">Save</button>
    <div class="how-to">
      <p>1. Go to <a href="https://zapier.com" target="_blank">Zapier</a> and create a new Zap<br>
      2. Set trigger to "Webhooks by Zapier" → Catch Hook<br>
      3. Set action to HubSpot → Create Contact<br>
      4. Copy the webhook URL and paste it above</p>
    </div>
  </div>

  <div class="int-section">
    <div class="int-header">
      <div class="int-icon">GHL</div>
      <div>
        <div class="int-title">GoHighLevel</div>
        <div class="int-desc">Send leads directly to your GoHighLevel account</div>
      </div>
    </div>
    <div class="field">
      <label>GoHighLevel Webhook URL</label>
      <input type="url" id="ghl-webhook" placeholder="https://hooks.zapier.com/hooks/catch/…">
    </div>
    <button class="save-btn" onclick="save('gohighlevel', 'ghl-webhook')">Save</button>
    <div class="how-to">
      <p>1. In GoHighLevel go to Settings → Integrations → Webhooks<br>
      2. Create a new webhook and copy the URL<br>
      3. Paste it above — no Zapier needed</p>
    </div>
  </div>

  <div class="int-section">
    <div class="int-header">
      <div class="int-icon">ZP</div>
      <div>
        <div class="int-title">Zapier / Custom Webhook</div>
        <div class="int-desc">Connect to any app via Zapier or a custom webhook</div>
      </div>
    </div>
    <div class="field">
      <label>Webhook URL</label>
      <input type="url" id="custom-webhook" placeholder="https://hooks.zapier.com/hooks/catch/…">
    </div>
    <button class="save-btn" onclick="save('custom', 'custom-webhook')">Save</button>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
const API = 'https://leadly-backend-tgbl.onrender.com';
const token = localStorage.getItem('leadly_token');
if (!token) window.location.href = '/signup-page';

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

async function save(type, inputId) {
  const url = document.getElementById(inputId).value.trim();
  if (!url) { toast('Please enter a webhook URL'); return; }
  await fetch(API + '/settings/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ webhookUrl: url, webhookType: type })
  });
  toast('Saved!');
}

// Load existing webhook
async function loadSettings() {
  const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 401) { window.location.href = '/signup-page'; return; }
  const d = await res.json();
  if (d.webhookUrl) {
    document.getElementById('custom-webhook').value = d.webhookUrl;
  }
}
loadSettings();
</script>
</body>
</html>`;
}

function generateLandingPage(biz) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${biz.businessName} | Get a Free Quote</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}
.hero{padding:60px 24px;text-align:center}
.badge{display:inline-block;background:rgba(0,232,122,0.1);color:#00e87a;padding:6px 16px;border-radius:100px;font-size:13px;margin-bottom:24px}
h1{font-size:clamp(28px,5vw,48px);font-weight:800;margin-bottom:16px}
h1 span{color:#00e87a}
.subtitle{color:#999;font-size:18px;margin-bottom:40px}
.card{max-width:480px;margin:0 auto;background:#111;border:1px solid #222;border-radius:24px;padding:40px}
.card h2{font-size:22px;font-weight:700;margin-bottom:6px}
.card p{color:#999;margin-bottom:24px;font-size:14px}
input{width:100%;background:rgba(255,255,255,0.05);border:1px solid #333;color:#fff;padding:13px 16px;border-radius:8px;font-size:15px;margin-bottom:11px;outline:none}
input:focus{border-color:rgba(0,232,122,0.4)}
input::placeholder{color:#666}
button{width:100%;background:#00e87a;color:#000;border:none;padding:15px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer}
button:hover{background:#00c96a}
.success{display:none;text-align:center;padding:20px}
.success h3{font-size:22px;margin:12px 0 8px}
.success p{color:#999}
.footer{text-align:center;padding:24px;color:#444;font-size:13px}
.footer a{color:#00e87a;text-decoration:none}
</style>
</head>
<body>
<div class="hero">
  <div class="badge">⚡ Fast Response Guaranteed</div>
  <h1>${biz.businessName}<br><span>Get a Free Quote</span></h1>
  ${biz.description ? `<p class="subtitle">${biz.description}</p>` : ''}
  <div class="card">
    <h2>📍 Request a Free Quote</h2>
    <p>Fill out the form and we'll get back to you within 24 hours.</p>
    <div id="leadForm">
      <input type="text" id="name" placeholder="Your name" required>
      <input type="email" id="email" placeholder="Email address" required>
      <input type="tel" id="phone" placeholder="Phone number">
      <input type="text" id="message" placeholder="What do you need help with?">
      <button onclick="submitLead()">Get My Free Quote →</button>
    </div>
    <div class="success" id="success">
      <div style="font-size:48px">✅</div>
      <h3>Request Sent!</h3>
      <p>We'll be in touch within 24 hours.</p>
    </div>
  </div>
</div>
<div class="footer">Powered by <a href="https://useleadly.io">Leadly</a></div>
<script>
async function submitLead() {
  const name  = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  if (!name || !email) { alert('Please enter your name and email.'); return; }
  await fetch('https://leadly-backend-tgbl.onrender.com/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email,
      phone: document.getElementById('phone').value,
      message: document.getElementById('message').value,
      business: '${biz.businessName}',
      businessSlug: '${biz.slug}',
      url: window.location.href
    })
  });
  document.getElementById('leadForm').style.display = 'none';
  document.getElementById('success').style.display  = 'block';
}
</script>
</body>
</html>`;
}

// ─── Plan caps ─────────────────────────────────────────────────────────────
const PLAN_CAPS = { free: 50, starter: 150, pro: 250, agency: 999999 };

// ─── HTTP Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  const url = req.url.split("?")[0];

  // ── GET /signup-page ────────────────────────────────────────────────────
  if (req.method === "GET" && url === "/signup-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateSignupPage());
    return;
  }

  // ── GET /dashboard-page ─────────────────────────────────────────────────
  if (req.method === "GET" && url === "/dashboard-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateDashboardPage());
    return;
  }


  // ── GET /integrations-page ──────────────────────────────────────────────
  if (req.method === "GET" && url === "/integrations-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateIntegrationsPage());
    return;
  }

  // ── GET /page/:slug ─────────────────────────────────────────────────────
  if (req.method === "GET" && req.url.startsWith("/page/")) {
    const slug = req.url.replace("/page/", "").split("?")[0];
    const database = await getDb();
    const biz = await database.collection("businesses").findOne({ slug });
    if (!biz) { res.writeHead(404); res.end("Page not found"); return; }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateLandingPage(biz));
    return;
  }

  // ── POST /signup ─────────────────────────────────────────────────────────
  if (req.method === "POST" && url === "/signup") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { name, email, password, businessName, plan } = JSON.parse(body);
        if (!name || !email || !password || !businessName) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "All fields are required" })); return;
        }
        if (password.length < 8) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Password must be at least 8 characters" })); return;
        }
        const database  = await getDb();
        const existing  = await database.collection("users").findOne({ email: email.toLowerCase() });
        if (existing) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "An account with that email already exists" })); return;
        }
        const token    = generateToken();
        const slug     = generateSlug(businessName);
        const userPlan = plan && PLAN_CAPS[plan] ? plan : "free";
        const user     = {
          name, email: email.toLowerCase(),
          password: hashPassword(password),
          token, businessName, slug,
          plan: userPlan,
          webhookUrl: "",
          createdAt: new Date(),
        };
        await database.collection("users").insertOne(user);
        // Create business doc
        await database.collection("businesses").updateOne(
          { slug },
          { $setOnInsert: { businessName, slug, email: email.toLowerCase(), description: "", city: "", createdAt: new Date() } },
          { upsert: true }
        );
        // Send welcome email (non-blocking)
        sendWelcomeEmail(user).catch(console.error);
        // Notify admin
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "Leadly <onboarding@resend.dev>",
            to: NOTIFY_EMAIL,
            subject: `🆕 New signup: ${name} (${email})`,
            html: `<p><b>${name}</b> (${email}) just signed up for Leadly.<br>Business: ${businessName}<br>Plan: ${userPlan}</p>`
          })
        }).catch(console.error);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token, slug }));
      } catch (err) {
        console.error("Signup error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Server error. Please try again." }));
      }
    });
    return;
  }

  // ── POST /login ──────────────────────────────────────────────────────────
  if (req.method === "POST" && url === "/login") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { email, password } = JSON.parse(body);
        const database = await getDb();
        const user     = await database.collection("users").findOne({ email: email.toLowerCase() });
        if (!user || user.password !== hashPassword(password)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid email or password" })); return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token: user.token, slug: user.slug, name: user.name }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Server error" }));
      }
    });
    return;
  }

  // ── GET /dashboard ───────────────────────────────────────────────────────
  if (req.method === "GET" && url === "/dashboard") {
    const token   = req.headers.authorization?.replace("Bearer ", "");
    const user    = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    const database = await getDb();
    const now      = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const allLeads   = await database.collection("leads").find({ businessSlug: user.slug }).sort({ timestamp: -1 }).toArray();
    const monthLeads = allLeads.filter(l => new Date(l.timestamp) >= monthStart);
    const cap        = PLAN_CAPS[user.plan] || 50;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      name:          user.name,
      businessName:  user.businessName,
      plan:          user.plan || "free",
      cap,
      pageUrl:       `https://leadly-backend-tgbl.onrender.com/page/${user.slug}`,
      webhookUrl:    user.webhookUrl || "",
      leadCount:     allLeads.length,
      leadsThisMonth: monthLeads.length,
      leads:         allLeads.slice(0, 20),
    }));
    return;
  }

  // ── POST /settings/webhook ───────────────────────────────────────────────
  if (req.method === "POST" && url === "/settings/webhook") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user  = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      const { webhookUrl } = JSON.parse(body);
      const database = await getDb();
      await database.collection("users").updateOne({ token }, { $set: { webhookUrl: webhookUrl || "" } });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }


  // ── GET /search-places ──────────────────────────────────────────────────
  if (req.method === "GET" && url === "/search-places") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user  = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    const params = new URLSearchParams(req.url.split("?")[1] || "");
    const query  = params.get("q");
    if (!query) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "No query" })); return; }
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      const gUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" + encodeURIComponent(query) + "&key=" + apiKey;
      const r = await fetch(gUrl);
      const data = await r.json();
      const results = (data.results || []).slice(0, 20).map(p => ({
        name:    p.name,
        address: p.formatted_address,
        phone:   p.formatted_phone_number || "",
        placeId: p.place_id,
        rating:  p.rating,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /leads ──────────────────────────────────────────────────────────
  if (req.method === "POST" && url === "/leads") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const lead = { ...JSON.parse(body), timestamp: new Date() };
        const database = await getDb();
        await database.collection("leads").insertOne(lead);
        // Find business owner and notify
        const owner = await database.collection("users").findOne({ slug: lead.businessSlug });
        const notifyTo = owner?.email || NOTIFY_EMAIL;
        sendLeadEmail(lead, notifyTo).catch(console.error);
        if (owner?.webhookUrl) fireWebhook(owner.webhookUrl, lead).catch(console.error);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("Lead error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── POST /checkout ───────────────────────────────────────────────────────
  if (req.method === "POST" && url === "/checkout") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user  = await getUserFromToken(token);
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { plan } = JSON.parse(body);
        const session  = await createCheckoutSession(plan, user?.email);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ url: session.url }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── POST /register-business (legacy) ─────────────────────────────────────
  if (req.method === "POST" && url === "/register-business") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const biz      = JSON.parse(body);
        const slug     = generateSlug(biz.businessName);
        const database = await getDb();
        await database.collection("businesses").updateOne({ slug }, { $set: { ...biz, slug, updatedAt: new Date() } }, { upsert: true });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, url: `https://leadly-backend-tgbl.onrender.com/page/${slug}`, slug }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── GET /health ──────────────────────────────────────────────────────────
  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Leadly API" }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🎯 Leadly API running on port ${PORT}`);
  getDb().catch(console.error); // warm up connection
});
