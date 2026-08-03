// Leadly Backend — MongoDB edition
import { createServer } from "http";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
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
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// reverse map so the webhook can turn a price id back into a plan name
const PLAN_BY_PRICE = Object.fromEntries(
  Object.entries(PRICE_IDS).map(([plan, price]) => [price, plan])
);

async function createCheckoutSession(plan, userEmail) {
  const priceId = PRICE_IDS[plan] || PRICE_IDS.starter;
  const params = new URLSearchParams({
    "payment_method_types[]": "card",
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: "https://useleadly.io/dashboard-page?success=true",
    cancel_url:  "https://useleadly.io/pricing",
  });
  if (userEmail) params.set("customer_email", userEmail);
  // stamp the plan so the webhook doesn't have to look up line items
  params.set("metadata[plan]", plan);
  params.set("subscription_data[metadata][plan]", plan);
  if (userEmail) params.set("metadata[email]", userEmail);
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
    <a href="https://useleadly.io/page/${user.slug}" style="color:#00b85f;font-weight:700;font-size:16px">
      useleadly.io/page/${user.slug}
    </a>
  </div>
  <p style="color:#555">Share this link on social media, in your email signature, or anywhere you want leads to come from.</p>
  <a href="https://useleadly.io/dashboard-page" style="display:inline-block;background:#00e87a;color:#080808;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">Go to your dashboard →</a>
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
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var s=document.createElement("script");s.type="text/javascript",s.async=!0,s.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(s,a)};
  ttq.load('D901Q0RC77U4748KI7O0');
  ttq.page();
  ttq.track('ViewContent');
}(window, document, 'ttq');
</script>
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
.trust-bar{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin:0 0 28px}
.trust-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#c9c9c4;padding:8px 14px;border-radius:100px;font-size:13px;font-weight:500}
.trust-pill span{color:#00e87a;font-weight:700}
@media(max-width:520px){.trust-bar{gap:8px}.trust-pill{padding:6px 10px;font-size:12px}}
.trust-item{display:flex;align-items:center;gap:6px;color:#666;font-size:13px}
.trust-item span{color:#00e87a}
.price-hook{background:rgba(0,232,122,0.08);border:1px solid rgba(0,232,122,0.25);border-radius:10px;padding:12px 16px;font-size:14px;color:#c9c9c4;margin-bottom:24px;text-align:center;line-height:1.5}
.price-hook b{color:#00e87a}
.price-hook s{color:#777}
.benefits{margin:22px 0 0;padding:0;list-style:none}
.benefits li{display:flex;gap:9px;align-items:flex-start;color:#a8a8a2;font-size:13.5px;line-height:1.45;margin-bottom:9px}
.benefits li span{color:#00e87a;font-weight:700;flex-shrink:0}
.proof-line{text-align:center;color:#666;font-size:12.5px;margin-top:18px}
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
      <h1>Turn your website visitors into paying clients</h1>
      <p class="sub">Your own lead capture page, live in 60 seconds. Every lead goes straight to you.</p>
      <div class="price-hook">Most lead services charge <s>$30–100 per lead</s>.<br><b>Leads from your Leadly page are free. Forever.</b></div>
      <div class="trust-bar">
        <div class="trust-pill"><span>🔒</span> SSL encrypted</div>
        <div class="trust-pill"><span>✓</span> Cancel anytime</div>
        <div class="trust-pill"><span>⚡</span> Instant setup</div>
      </div>

      <div class="tabs">
        <button class="tab active" onclick="switchTab('signup')">Create account</button>
        <button class="tab" onclick="switchTab('login')">Sign in</button>
      </div>

      <div id="error" class="error"></div>

      <!-- SIGNUP -->
      <div id="signup-fields">
        <div class="field"><label>Email</label><input type="email" id="s-email" placeholder="you@yourbusiness.com" autocomplete="email"></div>
        <div class="field"><label>Password</label><input type="password" id="s-pass" placeholder="At least 8 characters" autocomplete="new-password"></div>
        <button class="btn" id="signup-btn" onclick="doSignup()">Create free account →</button>
        <div class="trust">
          <div class="trust-item"><span>✓</span> No credit card</div>
          <div class="trust-item"><span>✓</span> Free forever</div>
          <div class="trust-item"><span>✓</span> Setup in 60s</div>
        </div>
        <ul class="benefits">
          <li><span>✓</span> A branded page that captures leads from your website 24/7 — even while you sleep</li>
          <li><span>✓</span> Find local business leads with the built-in lead finder</li>
          <li><span>✓</span> Send every lead to Salesforce, HubSpot, GoHighLevel, or Zapier automatically</li>
        </ul>
        <p class="proof-line">Built for freelancers, agencies & local businesses</p>
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
      <p>One quick step to set up your page…</p>
      <a href="/onboarding-page">Continue →</a>
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
  const email    = document.getElementById('s-email').value.trim();
  const password = document.getElementById('s-pass').value;

  if (!email || !password) { showError('Please enter your email and a password.'); return; }
  if (password.length < 8) { showError('Password must be at least 8 characters.'); return; }

  const btn = document.getElementById('signup-btn');
  btn.disabled = true; btn.textContent = 'Creating account…';

  try {
    const res  = await fetch(API + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, plan: urlPlan || 'free' })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('leadly_token', data.token); if(data.slug) localStorage.setItem('leadly_slug', data.slug);
      if (window.ttq) ttq.track('CompleteRegistration');
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
      window.location.href = '/dashboard-page';
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
  setTimeout(() => { window.location.href = '/onboarding-page'; }, 1200);
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

function generateOnboardingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Set up your page — Leadly</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#080808;color:#f5f5f0;min-height:100vh;display:flex;flex-direction:column}
nav{padding:20px 40px;border-bottom:1px solid rgba(255,255,255,0.08)}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;text-decoration:none;color:#f5f5f0}
.logo span{color:#00e87a}
.main{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 24px}
.box{width:100%;max-width:440px}
.badge{display:inline-block;background:rgba(0,232,122,0.1);color:#00e87a;padding:6px 14px;border-radius:100px;font-size:13px;font-weight:600;margin-bottom:24px}
h1{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;margin-bottom:8px;line-height:1.2}
.sub{color:#888;font-size:15px;margin-bottom:32px}
.field{margin-bottom:14px}
label{display:block;font-size:13px;color:#888;margin-bottom:6px;font-weight:500}
input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:13px 16px;border-radius:8px;font-size:15px;outline:none;font-family:'DM Sans',sans-serif}
input:focus{border-color:rgba(0,232,122,0.5)}
input::placeholder{color:#555}
.btn{width:100%;background:#00e87a;color:#000;border:none;padding:15px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;font-family:'DM Sans',sans-serif}
.btn:disabled{opacity:0.6;cursor:not-allowed}
.error{color:#ff5555;font-size:13px;margin-bottom:12px;padding:10px 14px;background:rgba(255,85,85,0.1);border-radius:6px;display:none}
.hint{color:#555;font-size:13px;margin-top:14px;text-align:center}
.success{display:none}
.success h1{margin-bottom:12px}
.link-box{background:rgba(0,232,122,0.08);border:1px solid rgba(0,232,122,0.3);border-radius:10px;padding:18px 20px;margin:20px 0;word-break:break-all;font-size:16px;color:#00e87a;font-weight:600;text-align:center}
.btn-secondary{width:100%;background:transparent;color:#f5f5f0;border:1px solid rgba(255,255,255,0.15);padding:14px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px;font-family:'DM Sans',sans-serif}
.btn-secondary:hover{background:rgba(255,255,255,0.05)}
.steps{margin:24px 0;padding:20px;background:rgba(255,255,255,0.03);border-radius:10px}
.step{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;font-size:14px;color:#c9c9c4;line-height:1.5}
.step:last-child{margin-bottom:0}
.step-num{flex-shrink:0;width:22px;height:22px;background:#00e87a;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}
.copied{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#00e87a;color:#000;padding:12px 24px;border-radius:100px;font-weight:600;font-size:14px;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:100}
.copied.show{opacity:1}
</style>
</head>
<body>
<nav><a href="https://useleadly.io" class="logo">Lead<span>ly</span></a></nav>
<div class="main">
  <div class="box">
    <div class="badge">⚡ Last step</div>
    <h1>Set up your lead page</h1>
    <p class="sub">This creates your public link — the page you'll share to capture leads.</p>
    <div id="error" class="error"></div>
    <div class="field"><label>Your name</label><input type="text" id="o-name" placeholder="Jane Smith" autocomplete="name"></div>
    <div class="field"><label>Business name</label><input type="text" id="o-biz" placeholder="Smith Marketing" autocomplete="organization"></div>
    <button class="btn" id="o-btn" onclick="save()">Create my lead page →</button>
    <div class="hint">Your link: useleadly.io/page/<span id="slug-preview">your-business</span></div>
    </div>

    <div class="box success" id="success-box">
      <div class="badge">🎉 You're live</div>
      <h1>Your lead page is ready</h1>
      <p class="sub">Copy your link below and share it — every visitor who fills out the form becomes a lead in your dashboard.</p>
      <div class="link-box" id="live-link">useleadly.io/page/your-business</div>
      <button class="btn" onclick="copyLink()">📋 Copy my link</button>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><div>Paste your link in your Instagram/TikTok bio, or text it to prospects</div></div>
        <div class="step"><div class="step-num">2</div><div>New leads show up instantly on your dashboard</div></div>
        <div class="step"><div class="step-num">3</div><div>Follow up fast — hot leads convert best in the first hour</div></div>
      </div>
      <button class="btn-secondary" onclick="goToDashboard()">Go to dashboard →</button>
  </div>
  <div class="copied" id="copied-toast">Link copied!</div>
</div>
<script>
const API = 'https://leadly-backend-tgbl.onrender.com';
const token = localStorage.getItem('leadly_token');
if (!token) window.location.href = '/signup-page';

document.getElementById('o-biz').addEventListener('input', function() {
  const s = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'your-business';
  document.getElementById('slug-preview').textContent = s;
});

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg; el.style.display = 'block';
}

async function save() {
  document.getElementById('error').style.display = 'none';
  const name = document.getElementById('o-name').value.trim();
  const biz  = document.getElementById('o-biz').value.trim();
  if (!name || !biz) { showError('Please fill in both fields.'); return; }
  const btn = document.getElementById('o-btn');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const res  = await fetch(API + '/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name: name, businessName: biz })
    });
    const data = await res.json();
    if (data.success) {
      if (data.slug) localStorage.setItem('leadly_slug', data.slug);
      showSuccessScreen(data.url || ('https://useleadly.io/page/' + data.slug));
    } else {
      showError(data.error || 'Something went wrong.');
      btn.disabled = false; btn.textContent = 'Create my lead page →';
    }
  } catch (e) {
    showError('Network error. Please try again.');
    btn.disabled = false; btn.textContent = 'Create my lead page →';
  }
}

document.addEventListener('keydown', function(e) { if (e.key === 'Enter') save(); });

let liveLinkUrl = '';
function showSuccessScreen(fullUrl) {
  liveLinkUrl = fullUrl;
  document.querySelector('.box:not(.success)').style.display = 'none';
  const successBox = document.getElementById('success-box');
  successBox.style.display = 'block';
  document.getElementById('live-link').textContent = fullUrl.replace(/^https?:\\/\\//, '');
}
function copyLink() {
  navigator.clipboard.writeText(liveLinkUrl).then(() => {
    const t = document.getElementById('copied-toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = liveLinkUrl; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    const t = document.getElementById('copied-toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  });
}
function goToDashboard() { window.location.href = '/dashboard-page'; }
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
@media(max-width:860px){.leads-columns{grid-template-columns:1fr;gap:20px}}
@media(max-width:640px){
  nav{padding:14px 20px}
  .container{padding:24px 16px}
  .welcome{font-size:22px}
  .subtitle{margin-bottom:24px}
  .stats{grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:24px}
  .stat-card{padding:16px}
  .stat-num{font-size:28px;min-height:34px}
  .section{padding:18px}
  .url-box{flex-direction:column;align-items:stretch}
  .url-text{width:100%}
  .btn-sm,.btn-ghost{width:100%;text-align:center}
  .section-header{flex-wrap:wrap;gap:6px}
}
@media(max-width:400px){
  .stats{grid-template-columns:1fr}
}
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
.lead-link{color:#00e87a;text-decoration:none;border-bottom:1px solid rgba(0,232,122,0.3)}
.usage-bar{margin-top:10px;height:6px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden}
.load-more{width:100%;margin-top:10px;padding:12px;background:rgba(0,232,122,0.1);color:#00e87a;border:1px solid rgba(0,232,122,0.35);border-radius:10px;font-weight:600;cursor:pointer;font-size:14px}
.load-more:hover{background:rgba(0,232,122,0.18)}
.load-more:disabled{opacity:.6;cursor:default}
.prospect-count{font-size:12px;color:#888;margin-bottom:8px}
.find-email-btn{margin-top:6px;padding:5px 10px;font-size:12px;background:rgba(0,232,122,0.08);color:#00e87a;border:1px solid rgba(0,232,122,0.25);border-radius:7px;cursor:pointer}
.find-email-btn:hover{background:rgba(0,232,122,0.16)}
.find-email-btn:disabled{opacity:.5;cursor:default;color:#888;border-color:rgba(255,255,255,0.12);background:transparent}
.usage-fill{height:100%;border-radius:99px;transition:width .3s ease}
.lead-link:hover{border-bottom-color:#00e87a}
.lead-avatar{width:40px;height:40px;border-radius:50%;background:rgba(0,232,122,0.15);display:flex;align-items:center;justify-content:center;font-weight:700;color:#00e87a;font-size:16px;flex-shrink:0}
.lead-name{font-weight:600;margin-bottom:3px}
.lead-email{color:#00e87a;font-size:14px;margin-bottom:2px}
.lead-meta{color:#666;font-size:12px}
.lead-hidden{display:none}
.empty{text-align:center;padding:60px;color:#555}
.no-results{text-align:center;padding:40px;color:#555;font-size:14px;display:none}
.lead-body{flex:1;min-width:0}
.delete-lead-btn{background:none;border:none;color:#555;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;flex-shrink:0;font-family:'DM Sans',sans-serif}
.delete-lead-btn:hover{color:#ff5555;background:rgba(255,85,85,0.1)}

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


/* ── refinement layer ─────────────────────────────────────────────── */
/* Surfaces: soft top-lit gradient instead of flat fill */
.stat-card, .lead-card, .prospect-card{
  background:linear-gradient(168deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 42%, rgba(255,255,255,0) 100%), #101010;
  transition:border-color .18s ease, transform .18s ease, background .18s ease;
}
.lead-card:hover, .prospect-card:hover{
  border-color:rgba(255,255,255,0.16);
  transform:translateY(-1px);
}

/* Hierarchy: the plan-limit card is the one that matters */
#stats-row{align-items:stretch}
#stats-row .stat-card{display:flex;flex-direction:column;justify-content:center}
#stats-row .stat-card:nth-child(1) .stat-num,
#stats-row .stat-card:nth-child(3) .stat-num{
  color:#f5f5f0;
  font-size:34px;
  font-weight:600;
}
#stats-row .stat-card:nth-child(2){
  border-color:rgba(0,232,122,0.22);
  background:linear-gradient(168deg, rgba(0,232,122,0.07) 0%, rgba(0,232,122,0.015) 45%, rgba(255,255,255,0) 100%), #101010;
}
#stats-row .stat-card:nth-child(2) .stat-num{
  font-size:46px;
  letter-spacing:-0.02em;
}
.stat-label{letter-spacing:.01em}

/* Type: tighten the display face so it reads as a heading, not a label */
.welcome{letter-spacing:-0.02em}

/* Buttons feel pressable */
.add-lead-btn, .search-btn, .upgrade-btn, .load-more, .find-email-btn{
  transition:transform .12s ease, background .18s ease, box-shadow .18s ease;
}
.add-lead-btn:hover:not(:disabled), .upgrade-btn:hover{
  box-shadow:0 4px 14px rgba(0,232,122,0.22);
}
.add-lead-btn:active:not(:disabled), .load-more:active, .find-email-btn:active{transform:translateY(1px)}

/* Usage bar: give it a soft glow so the number and the bar read as one unit */
.usage-fill{box-shadow:0 0 12px rgba(0,232,122,0.35)}

/* Focus visible for keyboard users */
button:focus-visible, input:focus-visible, a:focus-visible{
  outline:2px solid rgba(0,232,122,0.6);
  outline-offset:2px;
}

.prospect-empty{line-height:1.55}

@media (prefers-reduced-motion: reduce){
  *{transition:none !important; animation:none !important}
  .lead-card:hover, .prospect-card:hover{transform:none}
}

/* Re-assert mobile sizing after the refinements above */
@media (max-width:768px){
  #stats-row .stat-card:nth-child(1) .stat-num,
  #stats-row .stat-card:nth-child(3) .stat-num{font-size:24px}
  #stats-row .stat-card:nth-child(2) .stat-num{font-size:32px}
}
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
  if (d.onboarded === false) { window.location.href = '/onboarding-page'; return; }
  allLeads = d.leads || [];
  window._stats = { total: d.leadCount ?? 0, month: d.leadsThisMonth ?? 0, cap: d.cap ?? 50 };
  renderDashboard(d);
  renderStats();
}

function renderDashboard(d) {
  const leadsHtml = allLeads.length === 0
    ? \`<div class="empty"><p>No leads yet.</p><p style="color:#777;font-size:14px;margin-top:8px;line-height:1.55">Search for businesses on the right to add your first one,<br>or share your page link to capture them automatically.</p></div>\`
    : allLeads.map((l, i) => {
        const initial = (l.name || '?')[0].toUpperCase();
        return \`<div class="lead-card" data-idx="\${i}">
          <div class="lead-avatar">\${initial}</div>
          <div class="lead-body">
            <div class="lead-name">\${l.name || 'Unknown'}</div>
            \${l.email ? \`<div class="lead-email">\${l.email}</div>\` : ''}
            \${l.phone ? \`<div class="lead-meta">📞 <a class="lead-link" href="tel:\${String(l.phone).replace(/[^0-9+]/g,'')}">\${l.phone}</a></div>\` : ''}
            \${l.website ? \`<div class="lead-meta">🔗 <a class="lead-link" target="_blank" rel="noopener" href="\${String(l.website).indexOf('http')===0?l.website:'https://'+l.website}">\${l.website}</a></div>\` : ''}
            \${l.message ? \`<div class="lead-meta" style="margin-top:4px">\${l.message}</div>\` : ''}
            \${!l.email && l.website ? \`<button class="find-email-btn" id="fe-\${l._id}" onclick="findEmail('\${l._id}')">✉︎ Find email</button>\` : ''}
          \${!l.phone && !l.website && !l.email ? '<div class="lead-meta" style="color:#666">No contact info available</div>' : ''}
            <div class="lead-meta" style="margin-top:4px">\${new Date(l.timestamp || Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
          </div>
          <button class="delete-lead-btn" onclick="deleteLead('\${l._id}', this)" title="Delete lead">✕</button>
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

  <div class="stats" id="stats-row"></div>

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

async function deleteLead(id, btn) {
  if (!id || id === 'undefined') { toast('Cannot delete — missing lead ID'); return; }
  const card = btn.closest('.lead-card');
  card.style.opacity = '0.4';
  btn.disabled = true;
  try {
    const res = await fetch(API + '/leads/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.success) {
      allLeads = allLeads.filter(l => String(l._id) !== String(id));
      card.remove();
      toast('Lead deleted');
      bumpStats(-1);
      const totalEl = document.querySelector('.section-header span');
      if (totalEl) totalEl.textContent = allLeads.length + ' total';
    } else {
      card.style.opacity = '1';
      btn.disabled = false;
      toast('Failed to delete lead');
    }
  } catch (e) {
    card.style.opacity = '1';
    btn.disabled = false;
    toast('Failed to delete lead');
  }
}

// ── live stat cards ────────────────────────────────────────────────────────
window._stats = { total: 0, month: 0, cap: 50 };

function renderStats() {
  const st = window._stats;
  const unlimited = st.cap === 999999;
  const pct = unlimited ? 0 : Math.min(100, Math.round((st.month / st.cap) * 100));
  const warn = !unlimited && st.month / st.cap >= 0.8;
  const box = document.getElementById('stats-row');
  if (!box) return;
  box.innerHTML =
    '<div class="stat-card"><div class="stat-num">' + st.total + '</div>' +
      '<div class="stat-label">Total leads</div></div>' +
    '<div class="stat-card">' +
      '<div class="stat-num">' + (unlimited ? st.month : st.month + ' / ' + st.cap) + '</div>' +
      '<div class="stat-label">This month' + (unlimited ? '' : ' (plan limit)') + '</div>' +
      (unlimited ? '' :
        '<div class="usage-bar"><div class="usage-fill" style="width:' + pct +
        '%;background:' + (warn ? '#ffb020' : '#00e87a') + '"></div></div>') +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-num">' + (unlimited ? '∞' : Math.max(0, st.cap - st.month)) + '</div>' +
      '<div class="stat-label">Remaining</div>' +
    '</div>';
}

function bumpStats(delta) {
  window._stats.total = Math.max(0, window._stats.total + delta);
  window._stats.month = Math.max(0, window._stats.month + delta);
  renderStats();
}


async function findEmail(id) {
  const btn = document.getElementById('fe-' + id);
  if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
  try {
    const res  = await fetch(API + '/leads/' + id + '/find-email', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.email) {
      const lead = allLeads.find(l => String(l._id) === String(id));
      if (lead) lead.email = data.email;
      if (btn) {
        const row = document.createElement('div');
        row.className = 'lead-email';
        row.textContent = data.email;
        btn.replaceWith(row);
      }
      toast('Found ' + data.email);
    } else {
      if (btn) { btn.disabled = true; btn.textContent = 'No email found'; }
      toast(data.reason || 'No email found on their site');
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '✉︎ Find email'; }
    toast('Lookup failed');
  }
}

async function findLeads() {
  const q = document.getElementById('prospect-query').value.trim();
  if (!q) return;
  window._prospects = [];
  window._nextPageToken = null;
  window._lastQuery = q;
  const box = document.getElementById('prospect-results');
  box.innerHTML = '<div class="searching">Searching...</div>';
  await fetchProspectPage(true);
}

async function loadMoreProspects() {
  const btn = document.getElementById('load-more-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  await fetchProspectPage(false);
}

async function fetchProspectPage(isFirst) {
  const box = document.getElementById('prospect-results');
  try {
    const url = window._nextPageToken
      ? API + '/search-places?pagetoken=' + encodeURIComponent(window._nextPageToken)
      : API + '/search-places?q=' + encodeURIComponent(window._lastQuery);
    const res  = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json();

    if (data.placesError) {
      if (isFirst) box.innerHTML = '<div class="prospect-empty">Search unavailable right now. Try again in a moment.</div>';
      return;
    }
    const batch = data.results || [];
    if (isFirst && batch.length === 0) {
      box.innerHTML = '<div class="prospect-empty">No results found. Try a different search.</div>';
      return;
    }
    window._prospects = (window._prospects || []).concat(batch);
    window._nextPageToken = data.nextPageToken || null;
    renderProspects();
  } catch (e) {
    if (isFirst) box.innerHTML = '<div class="prospect-empty">Search failed. Try again.</div>';
    const btn = document.getElementById('load-more-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Load more'; }
  }
}

function renderProspects() {
  const box = document.getElementById('prospect-results');
  const cards = window._prospects.map((p, i) => {
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

  const more = window._nextPageToken
    ? \`<button id="load-more-btn" class="load-more" onclick="loadMoreProspects()">Load more</button>\`
    : (window._prospects.length > 20 ? \`<div class="prospect-empty" style="padding:12px">That's all \${window._prospects.length} results.</div>\` : '');

  box.innerHTML = \`<div class="prospect-count">\${window._prospects.length} result\${window._prospects.length === 1 ? '' : 's'}</div>\` + cards + more;
}

async function addProspect(i) {
  const p = window._prospects[i];
  const btn = document.getElementById('add-' + i);
  btn.disabled = true; btn.textContent = 'Adding...';
  try {
    // Text Search never returns phone/website — fetch real contact details first
    let phone = p.phone || '';
    let website = '';
    let address = p.address || '';
    if (p.placeId) {
      try {
        const dRes = await fetch(API + '/place-details?placeId=' + encodeURIComponent(p.placeId), {
          headers: { Authorization: 'Bearer ' + token }
        });
        const d = await dRes.json();
        if (d.phone) phone = d.phone;
        if (d.website) website = d.website;
        if (d.address) address = d.address;
      } catch (e) { /* fall back to whatever we had */ }
    }
    const saveRes = await fetch(API + '/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        name: p.name,
        email: '',
        phone: phone,
        address: address,
        website: website,
        message: 'Added from lead search',
        businessSlug: localStorage.getItem('leadly_slug') || 'get-leadly',
        source: 'prospect_search'
      })
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok || saveData.error) {
      btn.disabled = false;
      btn.textContent = 'Add lead';
      if (saveRes.status === 402) {
        toast('Monthly limit reached (' + saveData.used + '/' + saveData.cap + ') — upgrade to add more');
      } else {
        toast(saveData.error || 'Could not add lead');
      }
      return;
    }
    btn.textContent = 'Added';
    toast('Lead added!');
    bumpStats(1);
    allLeads.unshift({ _id: saveData.id, name: p.name, email: '', phone: phone, address: address, website: website, timestamp: new Date() });
    document.getElementById('leads-list').innerHTML = allLeads.map((l, idx) => {
      const initial = (l.name || '?')[0].toUpperCase();
      return \`<div class="lead-card" data-idx="\${idx}">
        <div class="lead-avatar">\${initial}</div>
        <div class="lead-body">
          <div class="lead-name">\${l.name || 'Unknown'}</div>
          \${l.email ? \`<div class="lead-email">\${l.email}</div>\` : ''}
          \${l.phone ? \`<div class="lead-meta">📞 <a class="lead-link" href="tel:\${String(l.phone).replace(/[^0-9+]/g,'')}">\${l.phone}</a></div>\` : ''}
          \${l.website ? \`<div class="lead-meta">🔗 <a class="lead-link" target="_blank" rel="noopener" href="\${String(l.website).indexOf('http')===0?l.website:'https://'+l.website}">\${l.website}</a></div>\` : ''}
          \${l.address ? \`<div class="lead-meta"><a class="lead-link" target="_blank" rel="noopener" href="https://maps.google.com/?q=\${encodeURIComponent(l.address)}">\${l.address}</a></div>\` : ''}
          \${!l.email && l.website ? \`<button class="find-email-btn" id="fe-\${l._id}" onclick="findEmail('\${l._id}')">✉︎ Find email</button>\` : ''}
          \${!l.phone && !l.website && !l.email ? '<div class="lead-meta" style="color:#666">No contact info available</div>' : ''}
          <div class="lead-meta" style="margin-top:4px">\${new Date(l.timestamp || Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
        </div>
        <button class="delete-lead-btn" onclick="deleteLead('\${l._id}', this)" title="Delete lead">✕</button>
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
.int-icon{width:44px;height:44px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:8px;box-sizing:border-box}
.int-icon img,.int-icon svg{width:100%;height:100%;object-fit:contain}
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
      <div class="int-icon"><svg viewBox="0 0 24 24" fill="#00A1E0" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%"><path d="M10 6a4 4 0 0 1 7.3 1.2A3.5 3.5 0 0 1 21 10.5 3.5 3.5 0 0 1 17.5 14H7a4 4 0 0 1-.6-7.95A4 4 0 0 1 10 6z"/></svg></div>
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
      <div class="int-icon"><img src="https://cdn.simpleicons.org/hubspot/FF7A59" alt="HubSpot"></div>
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
      <div class="int-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#3B82F6" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path fill="#3B82F6" d="M13 7h-2v5.41l3.29 3.3 1.42-1.42L13 11.59z"/></svg></div>
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
      <div class="int-icon"><img src="https://cdn.simpleicons.org/zapier/FF4A00" alt="Zapier"></div>
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

// Load existing webhooks
async function loadSettings() {
  const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 401) { window.location.href = '/signup-page'; return; }
  const d = await res.json();
  const w = d.webhooks || {};
  if (w.salesforce)  document.getElementById('sf-webhook').value = w.salesforce;
  if (w.hubspot)     document.getElementById('hs-webhook').value = w.hubspot;
  if (w.gohighlevel) document.getElementById('ghl-webhook').value = w.gohighlevel;
  if (w.custom)      document.getElementById('custom-webhook').value = w.custom;
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

  // ── POST /stripe-webhook ─────────────────────────────────────────────────
  // Stripe is the ONLY thing allowed to change a user's plan.
  if (req.method === "POST" && url === "/stripe-webhook") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", async () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        // ---- verify signature -------------------------------------------
        if (!STRIPE_WEBHOOK_SECRET) {
          console.error("Webhook: STRIPE_WEBHOOK_SECRET not set");
          res.writeHead(500); res.end("no secret"); return;
        }
        const sigHeader = req.headers["stripe-signature"] || "";
        const parts = {};
        sigHeader.split(",").forEach(kv => {
          const i = kv.indexOf("=");
          if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
        });
        const timestamp = parts.t;
        const provided  = parts.v1;
        if (!timestamp || !provided) {
          res.writeHead(400); res.end("bad signature header"); return;
        }
        const expected = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
          .update(timestamp + "." + raw)
          .digest("hex");
        const a = Buffer.from(expected, "utf8");
        const b = Buffer.from(provided, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          console.error("Webhook: signature mismatch");
          res.writeHead(400); res.end("bad signature"); return;
        }
        // reject events older than 5 minutes (replay protection)
        if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
          res.writeHead(400); res.end("stale"); return;
        }

        const event    = JSON.parse(raw);
        const obj      = event.data?.object || {};
        const database = await getDb();

        const setPlan = async (query, plan) => {
          if (!query) return;
          const r = await database.collection("users").updateOne(query, {
            $set: { plan, planUpdatedAt: new Date() }
          });
          console.log("Webhook " + event.type + " -> plan=" + plan +
                      " matched=" + r.matchedCount);
        };

        // find the account this event belongs to
        const emailOf = o =>
          (o.customer_email || o.customer_details?.email || o.metadata?.email || "").toLowerCase();

        if (event.type === "checkout.session.completed") {
          const plan  = obj.metadata?.plan;
          const email = emailOf(obj);
          if (plan && PLAN_CAPS[plan] && email) {
            await setPlan({ email }, plan);
            // remember the stripe customer so later events can find this user
            if (obj.customer) {
              await database.collection("users").updateOne(
                { email }, { $set: { stripeCustomerId: obj.customer } }
              );
            }
          } else {
            console.error("Webhook: checkout completed but missing plan/email");
          }
        }

        else if (event.type === "customer.subscription.updated") {
          const priceId = obj.items?.data?.[0]?.price?.id;
          const plan    = obj.metadata?.plan || PLAN_BY_PRICE[priceId];
          const active  = ["active", "trialing"].includes(obj.status);
          const query   = obj.customer ? { stripeCustomerId: obj.customer } : null;
          if (query) await setPlan(query, active && plan ? plan : "free");
        }

        else if (event.type === "customer.subscription.deleted") {
          const query = obj.customer ? { stripeCustomerId: obj.customer } : null;
          if (query) await setPlan(query, "free");
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));
      } catch (err) {
        console.error("Webhook error:", err.message);
        res.writeHead(400); res.end("error");
      }
    });
    return;
  }

  // ── GET /signup-page ────────────────────────────────────────────────────
  if (req.method === "GET" && url === "/signup-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateSignupPage());
    return;
  }

  // ── GET /onboarding-page ────────────────────────────────────────────────
  if (req.method === "GET" && url === "/onboarding-page") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateOnboardingPage());
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
        const { email, password, plan } = JSON.parse(body);
        if (!email || !password) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Email and password are required" })); return;
        }
        const name         = email.split("@")[0];
        const businessName = name;
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
        const slug     = (generateSlug(businessName) || "user") + "-" + Math.random().toString(36).slice(2, 6);
        // Plan is NEVER taken from the client — only the Stripe webhook may upgrade.
        const userPlan = "free";
        const user     = {
          name, email: email.toLowerCase(),
          password: hashPassword(password),
          token, businessName, slug,
          plan: userPlan,
          onboarded: false,
          webhooks: { salesforce: "", hubspot: "", gohighlevel: "", custom: "" },
          createdAt: new Date(),
        };
        await database.collection("users").insertOne(user);
        // Create business doc
        await database.collection("businesses").updateOne(
          { slug },
          { $setOnInsert: { businessName, slug, email: email.toLowerCase(), description: "", city: "", createdAt: new Date() } },
          { upsert: true }
        );
        // Welcome email is sent after onboarding, once the real slug exists
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

  // ── POST /update-profile ─────────────────────────────────────────────────
  if (req.method === "POST" && url === "/update-profile") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        const user  = await getUserFromToken(token);
        if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
        const { name, businessName } = JSON.parse(body);
        if (!name || !businessName) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Name and business name are required" })); return;
        }
        const database = await getDb();
        let slug = generateSlug(businessName) || "my-business";
        const clash = await database.collection("users").findOne({ slug, email: { $ne: user.email } });
        if (clash) slug = slug + "-" + Math.random().toString(36).slice(2, 6);

        await database.collection("users").updateOne(
          { email: user.email },
          { $set: { name, businessName, slug, onboarded: true } }
        );
        // Move business doc from temp slug to real slug
        if (user.slug !== slug) await database.collection("businesses").deleteOne({ slug: user.slug });
        await database.collection("businesses").updateOne(
          { slug },
          { $set: { businessName, slug, email: user.email },
            $setOnInsert: { description: "", city: "", createdAt: new Date() } },
          { upsert: true }
        );
        // Welcome email now that the real page link exists
        sendWelcomeEmail({ ...user, name, businessName, slug }).catch(console.error);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, slug, url: `https://useleadly.io/page/${slug}` }));
      } catch (err) {
        console.error("update-profile error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Server error" }));
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
    // Legacy accounts only ever had a single `webhookUrl` field — treat that as their "custom" slot
    const webhooks = user.webhooks || { salesforce: "", hubspot: "", gohighlevel: "", custom: user.webhookUrl || "" };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      name:          user.name,
      businessName:  user.businessName,
      plan:          user.plan || "free",
      onboarded:     user.onboarded !== false,
      cap,
      pageUrl:       `https://useleadly.io/page/${user.slug}`,
      webhooks:      webhooks,
      leadCount:     allLeads.length,
      leadsThisMonth: monthLeads.length,
      leads:         allLeads.slice(0, 20),
    }));
    return;
  }


  // ── POST /leads/:id/find-email ──────────────────────────────────────────
  // Best-effort: fetch the lead's website and look for a contact address.
  if (req.method === "POST" && url.startsWith("/leads/") && url.endsWith("/find-email")) {
    const tok  = req.headers.authorization?.replace("Bearer ", "");
    const user = await getUserFromToken(tok);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    const leadId = url.split("/")[2];
    try {
      const database = await getDb();
      const lead = await database.collection("leads").findOne({
        _id: new ObjectId(leadId), businessSlug: user.slug
      });
      if (!lead)          { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Lead not found" })); return; }
      if (!lead.website)  { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ email: "", reason: "no website on file" })); return; }

      let site = String(lead.website).trim();
      if (!/^https?:\/\//i.test(site)) site = "https://" + site;
      let host = "";
      try { host = new URL(site).hostname; } catch { 
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ email: "", reason: "bad website url" })); return;
      }
      // Never let a stored URL point us at internal infrastructure
      if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[|0\.)/i.test(host)) {
        res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Blocked host" })); return;
      }

      const JUNK        = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/i;
      const BAD_DOMAINS = /(sentry\.|wixpress|example\.com|godaddy|squarespace|schema\.org|w3\.org|yourdomain|domain\.com)/i;
      const BAD_LOCAL   = /^(no-?reply|donotreply|postmaster|abuse|webmaster)@/i;

      const grab = async (target) => {
        const ctl = new AbortController();
        const t   = setTimeout(() => ctl.abort(), 6000);
        try {
          const r = await fetch(target, {
            signal: ctl.signal,
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadlyBot/1.0)" }
          });
          if (!r.ok) return "";
          const ct = r.headers.get("content-type") || "";
          if (!ct.includes("html")) return "";
          return (await r.text()).slice(0, 400000);
        } catch { return ""; }
        finally { clearTimeout(t); }
      };

      const pull = (html) => {
        const found = new Set();
        for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(m[1]);
        for (const m of html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) found.add(m[0]);
        return [...found]
          .map(e => e.trim().toLowerCase().replace(/[.,;:)]+$/, ""))
          .filter(e => e.includes("@") && e.length < 80 &&
                       !JUNK.test(e) && !BAD_DOMAINS.test(e) && !BAD_LOCAL.test(e));
      };

      // homepage first, then a contact page if nothing turned up
      let emails = pull(await grab(site));
      if (emails.length === 0) {
        for (const path of ["/contact", "/contact-us", "/about"]) {
          emails = pull(await grab(site.replace(/\/$/, "") + path));
          if (emails.length) break;
        }
      }

      const bare = host.replace(/^www\./, "");
      const pref = /^(info|contact|hello|sales|office|admin|service)@/i;
      emails.sort((a, b) => {
        const ao = a.endsWith("@" + bare) ? 0 : 1, bo = b.endsWith("@" + bare) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ap = pref.test(a) ? 0 : 1, bp = pref.test(b) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.length - b.length;
      });

      const email = emails[0] || "";
      if (email) {
        await database.collection("leads").updateOne(
          { _id: new ObjectId(leadId), businessSlug: user.slug },
          { $set: { email, emailSource: "website" } }
        );
      }
      console.log("find-email " + host + " -> " + (email || "none"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ email, reason: email ? "" : "no address found on site" }));
    } catch (err) {
      console.error("find-email error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /settings/webhook ───────────────────────────────────────────────
  if (req.method === "POST" && url === "/settings/webhook") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user  = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      const { webhookUrl, webhookType } = JSON.parse(body);
      const validTypes = ["salesforce", "hubspot", "gohighlevel", "custom"];
      const type = validTypes.includes(webhookType) ? webhookType : "custom";
      const database = await getDb();
      await database.collection("users").updateOne({ token }, { $set: { [`webhooks.${type}`]: webhookUrl || "" } });
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
    if (!query && !params.get("pagetoken")) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "No query" })); return; }
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      const base   = "https://maps.googleapis.com/maps/api/place/textsearch/json";
      const inToken = params.get("pagetoken");

      // ONE request per call. Page 2/3 are fetched on demand by "Load more",
      // so the first search stays fast.
      const gUrl = inToken
        ? base + "?pagetoken=" + encodeURIComponent(inToken) + "&key=" + apiKey
        : base + "?query=" + encodeURIComponent(query) + "&key=" + apiKey;

      const r    = await fetch(gUrl);
      const data = await r.json();
      console.log("Places: status=" + data.status +
                  " got=" + (data.results || []).length +
                  " nextToken=" + (data.next_page_token ? "yes" : "no") +
                  " q=" + (inToken ? "(page token)" : query));

      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("Places error:", data.status, data.error_message || "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results: [], nextPageToken: null, placesError: data.status }));
        return;
      }

      const results = (data.results || []).map(p => ({
        name:    p.name,
        address: p.formatted_address,
        phone:   p.formatted_phone_number || "",
        placeId: p.place_id,
        rating:  p.rating,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results, nextPageToken: data.next_page_token || null }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── GET /place-details ──────────────────────────────────────────────────
  // Text Search doesn't return phone/website — fetch full details for one place
  // right before the user adds it as a lead.
  if (req.method === "GET" && url === "/place-details") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user  = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    const params  = new URLSearchParams(req.url.split("?")[1] || "");
    const placeId = params.get("placeId");
    if (!placeId) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "No placeId" })); return; }
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      const fields = "formatted_phone_number,international_phone_number,website,formatted_address";
      const gUrl = "https://maps.googleapis.com/maps/api/place/details/json?place_id=" + encodeURIComponent(placeId) + "&fields=" + fields + "&key=" + apiKey;
      const r = await fetch(gUrl);
      const data = await r.json();
      const p = data.result || {};
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        phone:   p.formatted_phone_number || p.international_phone_number || "",
        website: p.website || "",
        address: p.formatted_address || "",
      }));
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
        // If an authenticated user is saving, trust the token over the client-sent slug
        const authTok = req.headers.authorization?.replace("Bearer ", "");
        if (authTok) {
          const authUser = await getUserFromToken(authTok);
          if (authUser?.slug) lead.businessSlug = authUser.slug;
        }
        const database = await getDb();
        // Look the owner up FIRST so we can enforce their monthly plan cap
        const owner = await database.collection("users").findOne({ slug: lead.businessSlug });
        if (owner) {
          const cap = PLAN_CAPS[owner.plan] || PLAN_CAPS.free;
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const usedThisMonth = await database.collection("leads").countDocuments({
            businessSlug: owner.slug,
            timestamp: { $gte: monthStart }
          });
          if (usedThisMonth >= cap) {
            console.log("Cap reached for " + owner.slug + " (" + usedThisMonth + "/" + cap + ")");
            res.writeHead(402, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              error: "Monthly lead limit reached",
              cap, used: usedThisMonth, plan: owner.plan || "free"
            }));
            return;
          }
        }
        const insertResult = await database.collection("leads").insertOne(lead);
        const notifyTo = owner?.email || NOTIFY_EMAIL;
        sendLeadEmail(lead, notifyTo).catch(console.error);
        if (owner?.webhooks) {
          Object.values(owner.webhooks).forEach(hookUrl => {
            if (hookUrl) fireWebhook(hookUrl, lead).catch(console.error);
          });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, id: insertResult.insertedId }));
      } catch (err) {
        console.error("Lead error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── DELETE /leads ────────────────────────────────────────────────────────
  if (req.method === "DELETE" && url.startsWith("/leads/")) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user  = await getUserFromToken(token);
    if (!user) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
    const leadId = url.split("/leads/")[1];
    try {
      const database = await getDb();
      const result = await database.collection("leads").deleteOne({
        _id: new ObjectId(leadId),
        businessSlug: user.slug   // scoped so users can only delete their own leads
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, deleted: result.deletedCount }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
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
        res.end(JSON.stringify({ success: true, url: `https://useleadly.io/page/${slug}`, slug }));
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
