<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Leadly — Free Lead Capture Page for Freelancers & Agencies | Get Clients Automatically</title>
<meta name="description" content="Get a free lead capture page in 60 seconds. Leadly automatically captures leads from your website 24/7 — perfect for freelancers, agencies, and small businesses. 30 day free trial.">
<meta name="keywords" content="free lead capture page, lead generation for freelancers, lead capture widget, automatic lead generation, lead page for agencies, small business lead generation, free lead page, website lead capture">
<meta name="google-site-verification" content="cVkkpTlzYJv_L128NmnOUsvcEHAsSH85JuPplZ_WdFI" />
<meta name="google-site-verification" content="9bSCGkxHTN7F70JtLsP_9a1ZiCxcG8mfz3wJ6_QSP2Y" />
<meta property="og:title" content="Leadly — Free Lead Capture Page for Freelancers & Agencies" />
<meta property="og:description" content="Automatically capture leads from your website 24/7. Get your free lead page in 60 seconds. No credit card required." />
<meta property="og:url" content="https://leadly-main.netlify.app" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Leadly — Free Lead Capture Page for Freelancers & Agencies" />
<meta name="twitter:description" content="Automatically capture leads from your website 24/7. Get your free lead page in 60 seconds." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --bg2: #111118;
    --bg3: #18181f;
    --border: rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.14);
    --text: #f0f0f5;
    --muted: #8888a0;
    --accent: #16a34a;
    --accent2: #4ade80;
    --accent-glow: rgba(22,163,74,0.25);
    --green: #4ade80;
    --green-bg: rgba(74,222,128,0.1);
    --radius: 12px;
    --radius-lg: 20px;
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  h1,h2,h3,h4,h5 { font-family: 'Syne', sans-serif; line-height: 1.15; }

  a { color: inherit; text-decoration: none; }

  /* NAV */
  nav {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 2rem;
    background: rgba(10,10,15,0.85);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }

  .nav-logo {
    font-family: 'Syne', sans-serif;
    font-weight: 800; font-size: 1.3rem;
    background: linear-gradient(135deg, #fff 40%, var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }

  .nav-links { display: flex; gap: 2rem; align-items: center; }
  .nav-links a { font-size: 0.9rem; color: var(--muted); transition: color .2s; }
  .nav-links a:hover { color: var(--text); }

  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 0.6rem 1.3rem; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 0.9rem;
    cursor: pointer; transition: all .2s; border: none;
  }

  .btn-primary {
    background: var(--accent); color: #fff;
    box-shadow: 0 0 24px var(--accent-glow);
  }
  .btn-primary:hover { background: #00c96a; transform: translateY(-1px); box-shadow: 0 0 32px var(--accent-glow); }

  .btn-outline {
    background: transparent; color: var(--text);
    border: 1px solid var(--border2);
  }
  .btn-outline:hover { background: var(--bg3); border-color: var(--accent); }

  .btn-lg { padding: 0.85rem 2rem; font-size: 1rem; border-radius: 10px; }

  /* HERO */
  .hero {
    min-height: 92vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 6rem 1.5rem 4rem;
    position: relative; overflow: hidden;
  }

  .hero::before {
    content: '';
    position: absolute; top: -200px; left: 50%; transform: translateX(-50%);
    width: 700px; height: 700px; border-radius: 50%;
    background: radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 100px;
    background: rgba(22,163,74,0.12); border: 1px solid rgba(22,163,74,0.3);
    font-size: 0.82rem; color: var(--accent2); font-weight: 500; margin-bottom: 2rem;
  }

  .hero-badge span { width: 6px; height: 6px; border-radius: 50%; background: var(--green); display: inline-block; animation: pulse 2s infinite; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  .hero h1 {
    font-size: clamp(2.8rem, 7vw, 5.5rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    max-width: 820px;
    margin-bottom: 1.5rem;
  }

  .hero h1 em {
    font-style: normal;
    background: linear-gradient(135deg, var(--accent2) 0%, #86efac 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }

  .hero-sub {
    font-size: 1.15rem; color: var(--muted); max-width: 540px;
    margin-bottom: 2.5rem; line-height: 1.7;
  }

  .hero-cta { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-bottom: 3rem; }

  .hero-trust {
    display: flex; align-items: center; gap: 10px;
    font-size: 0.82rem; color: var(--muted);
  }

  .trust-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--border2); }

  /* STATS */
  .stats {
    display: flex; justify-content: center; flex-wrap: wrap; gap: 1px;
    background: var(--border); border: 1px solid var(--border);
    border-radius: var(--radius-lg); overflow: hidden;
    max-width: 700px; margin: 4rem auto 0;
  }

  .stat {
    flex: 1; min-width: 150px;
    background: var(--bg2);
    padding: 1.5rem 2rem; text-align: center;
  }

  .stat-num {
    font-family: 'Syne', sans-serif;
    font-size: 2rem; font-weight: 700;
    color: var(--text); margin-bottom: 4px;
  }

  .stat-label { font-size: 0.82rem; color: var(--muted); }

  /* DEMO WIDGET */
  .demo-section {
    padding: 6rem 1.5rem;
    display: flex; flex-direction: column; align-items: center;
  }

  .section-tag {
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--accent2); margin-bottom: 1rem;
  }

  .demo-section h2 {
    font-size: clamp(2rem, 4vw, 3rem); font-weight: 800;
    text-align: center; max-width: 560px; margin-bottom: 1rem; letter-spacing: -0.02em;
  }

  .demo-section > p {
    color: var(--muted); text-align: center; max-width: 500px; margin-bottom: 3rem;
  }

  .demo-container {
    width: 100%; max-width: 900px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
    background: var(--border); border: 1px solid var(--border);
    border-radius: var(--radius-lg); overflow: hidden;
  }

  .demo-steps {
    background: var(--bg2); padding: 2rem;
    display: flex; flex-direction: column; gap: 0;
  }

  .demo-step {
    display: flex; gap: 1rem; padding: 1.2rem 1rem;
    border-bottom: 1px solid var(--border); cursor: pointer;
    transition: all .25s; border-radius: 10px; margin-bottom: 4px;
    border: 1px solid transparent;
  }

  .demo-step:last-child { border-bottom: 1px solid transparent; }

  .demo-step.active {
    background: rgba(22,163,74,0.08);
    border: 1px solid rgba(22,163,74,0.3);
  }

  .demo-step.active .step-icon { background: var(--accent); border-color: var(--accent); color: #fff; }
  .demo-step.active .step-title { color: #fff; font-weight: 700; font-size: 1rem; }
  .demo-step.active .step-desc { color: #ccc; }
  .demo-step.active .step-num { color: #fff; }

  .step-icon {
    width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
    border: 1px solid var(--border2); background: var(--bg3);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; transition: all .25s;
  }

  .step-num { font-family: 'Syne', sans-serif; font-size: 0.85rem; font-weight: 700; color: var(--muted); }

  .step-title { font-size: 0.9rem; font-weight: 500; color: var(--muted); margin-bottom: 4px; transition: all .25s; }
  .step-desc { font-size: 0.82rem; color: var(--muted); line-height: 1.5; transition: color .25s; }

  .demo-preview {
    background: var(--bg3); padding: 2rem;
    display: flex; align-items: center; justify-content: center;
  }

  /* Fake lead page widget */
  .mock-widget {
    background: var(--bg2); border: 1px solid var(--border2);
    border-radius: var(--radius); padding: 1.5rem; width: 100%; max-width: 280px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }

  .mock-widget-header { margin-bottom: 1rem; }
  .mock-widget-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1rem; margin-bottom: 4px; }
  .mock-widget-sub { font-size: 0.78rem; color: var(--muted); }

  .mock-input {
    width: 100%; padding: 0.6rem 0.8rem; margin-bottom: 8px;
    background: var(--bg3); border: 1px solid var(--border2);
    border-radius: 8px; color: var(--muted); font-size: 0.82rem;
    font-family: 'DM Sans', sans-serif;
  }

  .mock-btn {
    width: 100%; padding: 0.65rem;
    background: var(--accent); color: #fff; border: none;
    border-radius: 8px; font-size: 0.85rem; font-weight: 500;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
  }

  .mock-badge {
    margin-top: 10px; padding: 6px 10px;
    background: var(--green-bg); border-radius: 6px;
    font-size: 0.75rem; color: var(--green); text-align: center;
  }

  /* FEATURES */
  .features-section { padding: 6rem 1.5rem; max-width: 1100px; margin: 0 auto; }

  .features-section h2 {
    font-size: clamp(2rem, 4vw, 3rem); font-weight: 800;
    text-align: center; letter-spacing: -0.02em; margin-bottom: 1rem;
  }

  .features-section > p {
    text-align: center; color: var(--muted); margin-bottom: 3.5rem;
  }

  .features-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1px;
    background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;
  }

  .feature-card {
    background: var(--bg2); padding: 2rem;
    transition: background .2s;
  }
  .feature-card:hover { background: var(--bg3); }

  .feature-icon {
    width: 44px; height: 44px; border-radius: 10px;
    background: rgba(22,163,74,0.12); border: 1px solid rgba(22,163,74,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem; margin-bottom: 1.2rem;
  }

  .feature-card h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; }
  .feature-card p { font-size: 0.9rem; color: var(--muted); line-height: 1.6; }

  /* PRICING */
  .pricing-section { padding: 6rem 1.5rem; max-width: 900px; margin: 0 auto; }

  .pricing-section h2 {
    font-size: clamp(2rem, 4vw, 3rem); font-weight: 800;
    text-align: center; letter-spacing: -0.02em; margin-bottom: 1rem;
  }

  .pricing-section > p { text-align: center; color: var(--muted); margin-bottom: 3.5rem; }

  .pricing-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;
  }

  .pricing-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 2rem;
    display: flex; flex-direction: column;
    transition: border-color .2s, transform .2s;
  }

  .pricing-card:hover { border-color: var(--border2); transform: translateY(-2px); }

  .pricing-card.featured {
    background: var(--bg3);
    border: 1px solid var(--accent);
    box-shadow: 0 0 30px var(--accent-glow);
    position: relative;
  }

  .pricing-badge {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--accent); color: #fff;
    font-size: 0.72rem; font-weight: 600; padding: 4px 12px; border-radius: 100px;
    white-space: nowrap;
  }

  .pricing-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; }
  .pricing-original { font-size: 0.95rem; font-weight: 700; color: #666; text-decoration: line-through; margin-bottom: 2px; }
  .pricing-discount { display: inline-block; background: rgba(239,68,68,0.15); color: #f87171; font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 100px; margin-left: 6px; letter-spacing: 0.05em; }
  .pricing-price { font-family: 'Syne', sans-serif; font-size: 2.5rem; font-weight: 800; margin-bottom: 0.25rem; }
  .pricing-per { font-size: 0.82rem; color: var(--muted); margin-bottom: 1.5rem; }

  .pricing-divider { height: 1px; background: var(--border); margin-bottom: 1.5rem; }

  .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 10px; flex: 1; margin-bottom: 1.5rem; }

  .pricing-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 0.88rem; }
  .pricing-features li::before { content: '✓'; color: var(--green); flex-shrink: 0; margin-top: 1px; }

  /* SOCIAL PROOF */
  .proof-section { padding: 4rem 1.5rem; max-width: 900px; margin: 0 auto; }

  .proof-section h2 {
    font-size: clamp(1.8rem, 3.5vw, 2.5rem); font-weight: 800;
    text-align: center; letter-spacing: -0.02em; margin-bottom: 3rem;
  }

  .proof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }

  .proof-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 1.5rem;
  }

  .proof-quote { font-size: 0.92rem; line-height: 1.7; margin-bottom: 1rem; color: var(--text); }

  .proof-author { display: flex; align-items: center; gap: 10px; }

  .proof-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(22,163,74,0.2); display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; font-weight: 600; color: var(--accent2); flex-shrink: 0;
  }

  .proof-name { font-size: 0.88rem; font-weight: 500; }
  .proof-role { font-size: 0.78rem; color: var(--muted); }

  /* CTA SECTION */
  .cta-section {
    padding: 8rem 1.5rem; text-align: center;
    position: relative; overflow: hidden;
  }

  .cta-section::before {
    content: '';
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 600px; height: 400px; border-radius: 50%;
    background: radial-gradient(circle, rgba(22,163,74,0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  .cta-section h2 {
    font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 800;
    letter-spacing: -0.03em; max-width: 600px; margin: 0 auto 1.5rem;
  }

  .cta-section p { color: var(--muted); max-width: 460px; margin: 0 auto 2.5rem; }

  /* SIGNUP FORM */
  .signup-form {
    display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
    max-width: 480px; margin: 0 auto 1.5rem;
  }

  .signup-input {
    flex: 1; min-width: 200px;
    padding: 0.85rem 1.2rem; border-radius: 10px;
    background: var(--bg2); border: 1px solid var(--border2);
    color: var(--text); font-size: 0.95rem; font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .2s;
  }

  .signup-input:focus { border-color: var(--accent); }
  .signup-input::placeholder { color: var(--muted); }

  .cta-trust { font-size: 0.8rem; color: var(--muted); }

  /* FOOTER */
  footer {
    padding: 2rem 2rem; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; flex-wrap: gap;
    gap: 1rem;
  }

  .footer-logo {
    font-family: 'Syne', sans-serif; font-weight: 800;
    background: linear-gradient(135deg, #fff 40%, var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }

  footer p { font-size: 0.82rem; color: var(--muted); }

  /* SUCCESS STATE */
  .success-msg {
    display: none; padding: 1rem 1.5rem;
    background: var(--green-bg); border: 1px solid rgba(34,197,94,0.3);
    border-radius: 10px; color: var(--green); font-size: 0.9rem; text-align: center;
    max-width: 480px; margin: 0 auto;
  }

  /* RESPONSIVE */
  @media (max-width: 700px) {
    nav { padding: 1rem; }
    .nav-links { display: none; }
    .demo-container { grid-template-columns: 1fr; }
    .demo-preview { display: none; }
    footer { flex-direction: column; text-align: center; }
  }

  /* ANIMATIONS */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fade-up { animation: fadeUp 0.7s ease both; }
  .fade-up-2 { animation: fadeUp 0.7s 0.15s ease both; }
  .fade-up-3 { animation: fadeUp 0.7s 0.3s ease both; }
  .fade-up-4 { animation: fadeUp 0.7s 0.45s ease both; }
</style>
<!-- TikTok Pixel Code Start -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('D901Q0RC77U4748KI7O0');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- TikTok Pixel Code End -->
</head>
<body>

<!-- NAV -->
<nav>
  <div class="nav-logo">Leadly</div>
  <div class="nav-links">
    <a href="#how-it-works">How it works</a>
    <a href="#features">Features</a>
    <a href="#pricing">Pricing</a>
    <a href="https://leadly-backend-tgbl.onrender.com/dashboard-page">Dashboard</a>
  </div>
  <a href="https://leadly-main.netlify.app/pricing.html" class="btn btn-primary">Get free page →</a>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-badge"><span></span> Now live — get early access today</div>
  <h1 class="fade-up">Get free leads sent straight to your <em>CRM</em></h1>
  <p class="hero-sub fade-up-2">Leadly finds qualified local business leads for free and sends them straight to your Salesforce, HubSpot, or GoHighLevel — setup in 60 seconds.</p>
  <div class="hero-cta fade-up-3">
    <a href="https://leadly-main.netlify.app/pricing.html" class="btn btn-primary btn-lg">Get your free page in 60 seconds</a>
    <a href="#how-it-works" class="btn btn-outline btn-lg">See how it works</a>
  </div>
  <div class="hero-trust fade-up-4">
    <span>30 day free trial</span>
    <span class="trust-dot"></span>
    <span>No credit card required</span>
    <span class="trust-dot"></span>
    <span>Cancel anytime</span>
  </div>

  <div class="stats fade-up-4">
    <div class="stat">
      <div class="stat-num">2 min</div>
      <div class="stat-label">Average setup time</div>
    </div>
    <div class="stat">
      <div class="stat-num">24/7</div>
      <div class="stat-label">Always capturing leads</div>
    </div>
    <div class="stat">
      <div class="stat-num">$0</div>
      <div class="stat-label">Free to start</div>
    </div>
    <div class="stat">
      <div class="stat-num">3×</div>
      <div class="stat-label">More client inquiries</div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="demo-section" id="how-it-works">
  <div class="section-tag">How it works</div>
  <h2>Up and running in 3 steps</h2>
  <p>No website needed. No coding required. Get your lead page live in under 2 minutes.</p>

  <div class="demo-container">
    <div class="demo-steps">
      <div class="demo-step active" onclick="setStep(0)">
        <div class="step-icon"><span class="step-num">1</span></div>
        <div>
          <div class="step-title">Sign up free</div>
          <div class="step-desc">Create your account in seconds. No credit card needed.</div>
        </div>
      </div>
      <div class="demo-step" onclick="setStep(1)">
        <div class="step-icon"><span class="step-num">2</span></div>
        <div>
          <div class="step-title">Get your lead page</div>
          <div class="step-desc">Your custom page is instantly created. Share the link anywhere — social, email, or Google Business.</div>
        </div>
      </div>
      <div class="demo-step" onclick="setStep(2)">
        <div class="step-icon"><span class="step-num">3</span></div>
        <div>
          <div class="step-title">Watch leads come in</div>
          <div class="step-desc">Get notified the instant someone fills out your form. AI qualifies them automatically.</div>
        </div>
      </div>
    </div>

    <div class="demo-preview">
      <div class="mock-widget" id="mock-widget">
        <div class="mock-widget-header">
          <div class="mock-widget-title" id="mock-title">Your Business Name</div>
          <div class="mock-widget-sub" id="mock-sub">Get a free quote today</div>
        </div>
        <input class="mock-input" placeholder="Your name" readonly>
        <input class="mock-input" placeholder="Email address" readonly>
        <button class="mock-btn" id="mock-btn">Get My Free Quote →</button>
        <div class="mock-badge" id="mock-badge" style="display:none">✓ Lead captured! Notification sent.</div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="features-section" id="features">
  <div class="section-tag" style="text-align:center">Features</div>
  <h2>Everything you need to grow faster</h2>
  <p>Built for agencies, freelancers, consultants, and tech businesses who want results without complexity.</p>

  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">🤖</div>
      <h3>AI Lead Capture</h3>
      <p>Smart AI engages every visitor and captures their info automatically — even while you sleep.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🔍</div>
      <h3>Find Leads</h3>
      <p>Search for local businesses by type and location — like Apollo.io, powered by Google Maps. Get name, phone, website, and rating instantly.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">⚡</div>
      <h3>Instant Notifications</h3>
      <p>Get notified the second a new lead comes in via email or SMS. Never miss an opportunity.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🎯</div>
      <h3>Lead Qualification</h3>
      <p>AI scores and qualifies leads automatically so you only spend time on the best prospects.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📄</div>
      <h3>Free Lead Page</h3>
      <p>No website? No problem. Get a free lead capture page in 60 seconds. Share the link anywhere.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📊</div>
      <h3>CRM Integrations</h3>
      <p>Connect to Salesforce, HubSpot, Pipedrive, Slack, Google Sheets, and 5,000+ apps via Zapier. Works with any website — one line of code.</p>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="pricing-section" id="pricing">
  <div class="section-tag" style="text-align:center">Pricing</div>
  <h2>Simple, affordable pricing</h2>
  <p>No hidden fees. No long-term contracts. Cancel anytime.</p>

  <!-- Timer -->
  <div id="index-timer-banner" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;text-align:center;padding:12px 20px;border-radius:12px;margin-bottom:28px;font-size:0.9rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;">
    <span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;display:inline-block;animation:pulse 1s infinite;flex-shrink:0"></span>
    <span>🔥 Limited time offer — prices increase in</span>
    <span id="index-countdown" style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 12px;border-radius:6px;letter-spacing:0.05em;min-width:60px;display:inline-block">5:00</span>
    <span>— lock in your discount now</span>
  </div>

  <div class="pricing-grid">
    <div class="pricing-card">
      <div class="pricing-name">Free</div>
      <div class="pricing-original">$19/mo <span class="pricing-discount">LIMITED TIME</span></div>
      <div class="pricing-price">$0</div>
      <div class="pricing-per">forever, no credit card needed</div>
      <div class="pricing-divider"></div>
      <ul class="pricing-features">
        <li>50 leads per month</li>
        <li>Free lead capture page</li>
        <li>AI lead capture</li>
        <li>Email notifications</li>
        <li>1 website</li>
        <li>Basic analytics</li>
      </ul>
      <a href="https://leadly-backend-tgbl.onrender.com/dashboard-page" class="btn btn-outline" style="text-align:center;justify-content:center">Get started free</a>
    </div>

    <div class="pricing-card featured">
      <div class="pricing-badge">⚡ Most Popular</div>
      <div class="pricing-name">Pro</div>
      <div class="pricing-original">$59/mo <span class="pricing-discount">50% OFF</span></div>
      <div class="pricing-price">$29</div>
      <div class="pricing-per">per month after free trial</div>
      <div class="pricing-divider"></div>
      <ul class="pricing-features">
        <li>250 leads per month</li>
        <li>Free lead capture page</li>
        <li>AI lead capture + qualification scoring</li>
        <li>Email + SMS notifications</li>
        <li>5 websites</li>
        <li>Full analytics dashboard</li>
        <li>CRM integrations</li>
        <li>Priority email support</li>
      </ul>
      <a href="https://leadly-main.netlify.app/pricing" class="btn btn-primary" style="text-align:center;justify-content:center">Start free trial →</a>
    </div>

    <div class="pricing-card">
      <div class="pricing-name">Agency</div>
      <div class="pricing-original">$149/mo <span class="pricing-discount">47% OFF</span></div>
      <div class="pricing-price">$79</div>
      <div class="pricing-per">per month after free trial</div>
      <div class="pricing-divider"></div>
      <ul class="pricing-features">
        <li>Unlimited leads</li>
        <li>Unlimited lead capture pages</li>
        <li>Advanced AI scoring</li>
        <li>Email + SMS notifications</li>
        <li>Unlimited websites</li>
        <li>Full analytics + reporting</li>
        <li>CRM integrations</li>
        <li>White label option</li>
        <li>Priority support</li>
      </ul>
      <a href="https://leadly-main.netlify.app/pricing" class="btn btn-outline" style="text-align:center;justify-content:center">Start free trial →</a>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section" id="get-started">
  <div class="section-tag">Get started</div>
  <h2>Start getting clients today — it's free</h2>
  <p>Join the first wave of agencies and freelancers using Leadly. Get your free lead page in 60 seconds.</p>

  <div id="signup-area">
    <a href="https://leadly-main.netlify.app/pricing.html" class="btn btn-primary btn-lg">Start my 30 day free trial →</a>
    <p class="cta-trust">🔒 Try any plan free for 30 days. No credit card required.</p>
  </div>

  <div class="success-msg" id="success-msg" style="display:none">
    ✓ You're in! We'll have your lead page ready within 24 hours. Check your inbox.
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-logo">Leadly</div>
  <p>© 2026 Leadly. All rights reserved.</p>
  <div style="display:flex;gap:1.2rem">
    <a href="https://tiktok.com/@getleadly" style="font-size:0.82rem;color:var(--muted)">TikTok</a>
    <a href="https://instagram.com/getleadly_" style="font-size:0.82rem;color:var(--muted)">Instagram</a>
  </div>
</footer>

<script>
  const steps = [
    { title: 'Your Business Name', sub: 'Get a free quote today', btn: 'Get My Free Quote →', badge: false, inputs: true },
    { title: 'Your Business Name', sub: 'leadly.app/your-page', btn: 'Get My Free Quote →', badge: false, inputs: true },
    { title: 'New Lead! 🎉', sub: 'Jane Smith just filled out your form', btn: 'View lead in dashboard →', badge: true, inputs: false }
  ];

  const stepColors = ['var(--bg2)', 'var(--bg2)', 'rgba(22,163,74,0.06)'];
  const stepBorders = ['var(--border2)', 'rgba(22,163,74,0.4)', 'rgba(22,163,74,0.6)'];

  function setStep(i) {
    document.querySelectorAll('.demo-step').forEach((el, j) => el.classList.toggle('active', j === i));
    const s = steps[i];
    document.getElementById('mock-title').textContent = s.title;
    document.getElementById('mock-sub').textContent = s.sub;
    document.getElementById('mock-btn').textContent = s.btn;
    document.getElementById('mock-badge').style.display = s.badge ? 'block' : 'none';

    const widget = document.getElementById('mock-widget');
    widget.style.background = stepColors[i];
    widget.style.borderColor = stepBorders[i];
    widget.style.boxShadow = i === 2 ? '0 0 40px rgba(22,163,74,0.2)' : '0 20px 60px rgba(0,0,0,0.5)';

    const inputs = widget.querySelectorAll('.mock-input');
    inputs.forEach(el => {
      el.style.display = s.inputs ? 'block' : 'none';
    });

    if (i === 1) {
      document.getElementById('mock-sub').style.color = '#00e87a';
    } else if (i === 2) {
      document.getElementById('mock-sub').style.color = '#ccc';
      document.getElementById('mock-title').style.color = '#00e87a';
    } else {
      document.getElementById('mock-sub').style.color = '';
      document.getElementById('mock-title').style.color = '';
    }
  }

  function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    document.getElementById('signup-area').style.display = 'none';
    document.getElementById('success-msg').style.display = 'block';

    fetch('https://leadly-backend-tgbl.onrender.com/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => {});
    ttq.track('CompleteRegistration');
  }

  // 5 min countdown timer — starts when pricing comes into view
  const TIMER_KEY = 'leadly_timer_end';
  let timerStarted = false;

  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    let endTime = sessionStorage.getItem(TIMER_KEY);
    if (!endTime) {
      endTime = Date.now() + 5 * 60 * 1000;
      sessionStorage.setItem(TIMER_KEY, endTime);
    } else {
      endTime = parseInt(endTime);
    }

    function tick() {
      const remaining = endTime - Date.now();
      const el = document.getElementById('index-countdown');
      if (!el) return;
      if (remaining <= 0) {
        el.textContent = '0:00';
        document.getElementById('index-timer-banner').style.background = 'linear-gradient(135deg,#555,#333)';
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      el.textContent = mins + ':' + String(secs).padStart(2, '0');
      setTimeout(tick, 1000);
    }
    tick();
  }

  // Start timer when pricing section scrolls into view
  const pricingSection = document.getElementById('pricing');
  if (pricingSection) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) startTimer();
    }, { threshold: 0.1 });
    observer.observe(pricingSection);
  }
</script>
</body>
</html>
