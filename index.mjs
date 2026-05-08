// Leadly Lead Notification Backend
// Receives leads from widget and emails them via Resend

import { createServer } from "http";


const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const PRICE_IDS = {
  starter: 'price_1TTCAsD9M5I52vZq3tu7za1b',
  pro: 'price_1TTCCyD9M5I52vZqYTNu6boC',
  agency: 'price_1TTCEQD9M5I52vZq9BSth9uA',
};

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
