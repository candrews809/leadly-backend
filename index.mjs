<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Get Started Free — Leadly</title>

<!-- LEADLY CONVERSION PIXEL TRACKING -->
<script>
// Leadly Campaign Tracking
window.leadlyTracking = {
  campaignId: 'leadly-email-2026-08',
  sourceUrl: window.location.href,
  trackingPixelUrl: 'https://coleaandrews.com/api/conversion-pixel',
  
  // Track page view
  trackPageView: function() {
    const data = {
      event: 'page_view',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      utmSource: this.getUrlParam('utm_source'),
      utmMedium: this.getUrlParam('utm_medium'),
      utmCampaign: this.getUrlParam('utm_campaign'),
      email: this.getUrlParam('email') || 'unknown'
    };
    this.sendPixel(data);
  },
  
  // Track form submission (signup)
  trackSignup: function(email, plan) {
    const data = {
      event: 'signup',
      timestamp: new Date().toISOString(),
      email: email,
      plan: plan || 'free',
      source: 'email_campaign',
      campaignId: this.campaignId
    };
    this.sendPixel(data);
    console.log('✅ Signup tracked:', email);
  },
  
  // Track paid conversion
  trackPaidConversion: function(email, amount, stripePaymentId) {
    const data = {
      event: 'paid_conversion',
      timestamp: new Date().toISOString(),
      email: email,
      amount: amount,
      stripePaymentId: stripePaymentId,
      campaignId: this.campaignId
    };
    this.sendPixel(data);
    console.log('✅ Paid conversion tracked:', email, '$' + amount);
  },
  
  // Generic pixel send
  sendPixel: function(data) {
    // Send to server
    navigator.sendBeacon(this.trackingPixelUrl, JSON.stringify(data));
    
    // Also save to localStorage for offline tracking
    let events = JSON.parse(localStorage.getItem('leadly_events') || '[]');
    events.push(data);
    localStorage.setItem('leadly_events', JSON.stringify(events));
  },
  
  // Utility: get URL parameter
  getUrlParam: function(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }
};

// Track on page load
document.addEventListener('DOMContentLoaded', function() {
  window.leadlyTracking.trackPageView();
});

// Hook into form submission (adjust selector for your form)
document.addEventListener('submit', function(e) {
  if (e.target.id === 'signup-form' || e.target.classList.contains('leadly-signup')) {
    const emailInput = e.target.querySelector('input[type="email"]');
    if (emailInput) {
      window.leadlyTracking.trackSignup(emailInput.value, 'free');
    }
  }
});
</script>

<script>
!function (w, d, t) {
 w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var s=document.createElement("script");s.type="text/javascript",s.async=!0,s.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(s,a)};
 ttq.load('D901Q0RC77U4748KI7O0');
 ttq.page();
 ttq.track('ViewContent');
}(window, document, 'ttq');
</script>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#080808;color:#f5f5f0;min-height:100vh;display:flex;flex-direction:column}
nav{padding:20px 40px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Archivo',sans-serif;font-weight:800;font-size:22px;text-decoration:none;color:#f5f5f0}
.logo span{color:#00e87a}
.back{color:#888;text-decoration:none;font-size:14px}
.back:hover{color:#fff}
.main{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 24px}
.box{width:100%;max-width:440px}
.badge{display:inline-block;background:rgba(0,232,122,0.1);color:#00e87a;padding:6px 14px;border-radius:100px;font-size:13px;font-weight:600;margin-bottom:24px}
h1{font-family:'Archivo',sans-serif;font-size:32px;font-weight:800;margin-bottom:8px;line-height:1.2}
.sub{color:#888;font-size:15px;margin-bottom:32px}
.tabs{display:flex;gap:8px;margin-bottom:24px;background:rgba(255,255,255,0.05);padding:4px;border-radius:10px}
.tab{flex:1;padding:9px;border-radius:7px;border:none;background:transparent;color:#888;cursor:pointer;font-size:14px;font-family:'Inter',sans-serif;transition:all .15s}
.tab.active{background:#00e87a;color:#000;font-weight:700}
.field{margin-bottom:14px}
label{display:block;font-size:13px;color:#888;margin-bottom:6px;font-weight:500}
input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:13px 16px;border-radius:8px;font-size:15px;outline:none;font-family:'Inter',sans-serif;transition:border-color .15s}
input:focus{border-color:rgba(0,232,122,0.5)}
input::placeholder{color:#555}
.btn{width:100%;background:#00e87a;color:#000;border:none;padding:15px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;font-family:'Inter',sans-serif;transition:background .15s}
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
.success-box h2{font-family:'Archivo',sans-serif;font-size:28px;font-weight:800;margin:16px 0 8px}
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
 <div class="badge">Free forever — no credit card</div>
 <h1>Turn your website visitors into paying clients</h1>
 <p class="sub">Your own lead capture page, live in 60 seconds. Every lead goes straight to you.</p>
 <div class="price-hook">Most lead services charge $30–100 per lead.<br><b>Leads from your Leadly page are free. Forever.</b></div>
 <div class="trust-bar">
 <div class="trust-pill">SSL encrypted</div>
 <div class="trust-pill"><span>✓</span> Cancel anytime</div>
 <div class="trust-pill">Instant setup</div>
 </div>

 <div class="tabs">
 <button class="tab active" onclick="switchTab('signup')">Create account</button>
 <button class="tab" onclick="switchTab('login')">Sign in</button>
 </div>

 <div id="error" class="error"></div>

 <!-- SIGNUP -->
 <div id="signup-fields">
 <form id="signup-form">
 <div class="field"><label>Email</label><input type="email" id="s-email" placeholder="you@yourbusiness.com" autocomplete="email"></div>
 <div class="field"><label>Password</label><input type="password" id="s-pass" placeholder="At least 8 characters" autocomplete="new-password"></div>
 <button type="button" class="btn" id="signup-btn" onclick="doSignup()">Create free account →</button>
 </form>
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
 <div class="success-mark">Done</div>
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
 document.getElementById('login-fields').style.display = isSignup ? 'none' : 'block';
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
 const email = document.getElementById('s-email').value.trim();
 const password = document.getElementById('s-pass').value;

 if (!email || !password) { showError('Please enter your email and a password.'); return; }
 if (password.length < 8) { showError('Password must be at least 8 characters.'); return; }

 const btn = document.getElementById('signup-btn');
 btn.disabled = true; btn.textContent = 'Creating account…';

 try {
 const res = await fetch(API + '/signup', {
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
 const ckRes = await fetch(API + '/checkout', {
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
 const email = document.getElementById('l-email').value.trim();
 const password = document.getElementById('l-pass').value;
 if (!email || !password) { showError('Please enter your email and password.'); return; }

 const btn = document.getElementById('login-btn');
 btn.disabled = true; btn.textContent = 'Signing in…';

 try {
 const res = await fetch(API + '/login', {
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
 document.getElementById('success-box').style.display = 'block';
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
</html>
