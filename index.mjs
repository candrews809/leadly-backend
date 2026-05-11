// Leadly Lead Notification Backend
// Receives leads from widget and emails them via Resend


import { readFileSync, writeFileSync, existsSync } from "fs";

const BUSINESSES_FILE = "./businesses.json";

function loadBusinesses() {
  if (!existsSync(BUSINESSES_FILE)) return {};
  try { return JSON.parse(readFileSync(BUSINESSES_FILE, "utf8")); }
  catch { return {}; }
}

function saveBusiness(slug, data) {
  const businesses = loadBusinesses();
  businesses[slug] = data;
  writeFileSync(BUSINESSES_FILE, JSON.stringify(businesses, null, 2));
}

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
.hero { background: linear-gradient(135deg, #0a0a0a 0%, #111 100%); padding: 60px 24px; text-align: center; }
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
.success h3 { font-size: 24px; margin-bottom: 8px; }
.success p { color: #999; }
.footer { text-align: center; padding: 24px; color: #444; font-size: 13px; }
.footer a { color: #00e87a; text-decoration: none; }
</style>
</head>
<body>
<div class="hero">
  <div class="badge">⚡ Fast Response Guaranteed</div>
  <h1>${biz.businessName}<br><span>Get a Free Quote</span></h1>
  <p class="subtitle">${biz.description}</p>
  <p class="location">📍 ${biz.city}</p>
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

import { createServer } from "http";


const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const PRICE_IDS = {
  starter: 'price_1TTCAsD9M5I52vZq3tu7za1b',
  pro: 'price_1TTCCyD9M5I52vZqYTNu6boC',
  agency: 'price_1TTCEQD9M5I52vZq9BSth9uA',
};


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
      'success_url': 'https://leadly-main.netlify.app?success=true',
      'cancel_url': 'https://leadly-main.netlify.app?canceled=true',
    }),
  });
  return res.json();
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = "sfgiants4cole@gmail.com";
const PORT = process.env.PORT || 3000;

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
                <td style="padding: 12px 0; font-weight: 600; color: #080808;">${lead.name || "Not provided"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Email</td>
                <td style="padding: 12px 0; font-weight: 600; color: #080808;">
                  <a href="mailto:${lead.email}" style="color: #00b85f;">${lead.email || "Not provided"}</a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Phone</td>
                <td style="padding: 12px 0; font-weight: 600; color: #080808;">${lead.phone || "Not provided"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Business</td>
                <td style="padding: 12px 0; font-weight: 600; color: #080808;">${lead.business || "Not provided"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px 0; color: #666;">Message</td>
                <td style="padding: 12px 0; font-weight: 600; color: #080808;">${lead.message || "Not provided"}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666;">Source</td>
                <td style="padding: 12px 0; font-weight: 600; color: #080808;">${lead.url || "Leadly Widget"}</td>
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

// HTTP Server
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }


  if (req.method === "POST" && req.url === "/register-business") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const biz = JSON.parse(body);
        const slug = generateSlug(biz.businessName);
        saveBusiness(slug, { ...biz, slug, createdAt: new Date().toISOString() });
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

  if (req.method === "GET" && req.url.startsWith("/page/")) {
    const slug = req.url.replace("/page/", "");
    const businesses = loadBusinesses();
    const biz = businesses[slug];
    if (!biz) {
      res.writeHead(404);
      res.end("Page not found");
      return;
    }
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
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/leads") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const lead = JSON.parse(body);
        console.log("📥 New lead received:", lead);

        await sendLeadEmail(lead);

        // Fire webhook if business has one
        const businesses = loadBusinesses();
        const bizEntry = Object.values(businesses).find(b => b.businessName === lead.business);
        if (bizEntry?.webhookUrl) {
          await fireWebhook(bizEntry.webhookUrl, lead);
        }

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

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Leadly Lead API" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🎯 Leadly Lead API running on port ${PORT}`);
  console.log(`📧 Sending leads to: ${NOTIFY_EMAIL}`);
});
