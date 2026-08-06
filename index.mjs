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

  // CONVERSION TRACKING INDEXES
  await db.collection("conversions").createIndex({ email: 1 });
  await db.collection("conversions").createIndex({ event: 1 });
  await db.collection("conversions").createIndex({ timestamp: 1 });
  await db.collection("webhook_events").createIndex({ type: 1 });

  console.log("MongoDB connected");
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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Stripe ────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = proces…KEY;
const PRICE_IDS = {
  starter: "price_1TTCAsD9M5I52vZq3tu7za1b",
  pro: "price_1TTCCyD9M5I52vZqYTNu6boC",
  agency: "price_1TTCEQD9M5I52vZq9BSth9uA",
};
const STRIPE_WEBHOOK_SECRET = proces…RET;

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
    cancel_url: "https://useleadly.io/pricing",
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
const RESEND_API_KEY = proces…KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "tryleadly@gmail.com";

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
      subject: `New lead: ${lead.name} from ${lead.business || "your page"}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><div style="background:#00e87a;padding:20px;border-radius:12px 12px 0 0"><h1 style="color:#080808;margin:0;font-size:24px">New lead captured</h1></div><div style="background:#f5f5f5;padding:24px;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666;width:140px">Name</td><td style="padding:12px 0;font-weight:600">${lead.name || "—"}</td></tr><tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666">Email</td><td style="padding:12px 0;font-weight:600"><a href="mailto:${lead.email}" style="color:#00b85f">${lead.email || "—"}</a></td></tr><tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666">Phone</td><td style="padding:12px 0;font-weight:600">${lead.phone || "—"}</td></tr><tr style="border-bottom:1px solid #e0e0e0"><td style="padding:12px 0;color:#666">Message</td><td style="padding:12px 0;font-weight:600">${lead.message || "—"}</td></tr><tr><td style="padding:12px 0;color:#666">Source</td><td style="padding:12px 0;font-weight:600">${lead.url || "Leadly"}</td></tr></table><p style="margin-top:16px;color:#999;font-size:12px">Captured: ${new Date(lead.timestamp || Date.now()).toLocaleString()}</p></div></div>`,
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
      subject: "Your Leadly page is ready",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h1 style="font-size:28px;font-weight:800">Welcome to Leadly, ${user.name}</h1><p style="color:#555;font-size:16px;margin:16px 0">Your free lead capture page is live and ready to share.</p><div style="background:#f5f5f5;border-radius:12px;padding:20px;margin:24px 0"><p style="margin:0;font-size:14px;color:#666;margin-bottom:8px">Your lead page URL:</p><a href="https://useleadly.io/page/${user.slug}" style="color:#00b85f;font-weight:700;font-size:16px">useleadly.io/page/${user.slug}</a></div><p style="color:#555">Share this link on social media, in your email signature, or anywhere you want leads to come from.</p><a href="https://useleadly.io/dashboard-page" style="display:inline-block;background:#00e87a;color:#080808;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">Go to your dashboard →</a><p style="color:#aaa;font-size:12px;margin-top:32px">— Cole at Leadly</p></div>`,
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
      body: JSON.stringify({
        ...lead,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.log("Webhook error:", err.message);
  }
}

// ─── EXPRESS APP ───────────────────────────────────────────────────────────
import express from "express";

const app = express();

// IMPORTANT: Raw body middleware for Stripe webhooks (must be BEFORE express.json())
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// ─── ROUTES ────────────────────────────────────────────────────────────────

// signup
app.post("/signup", async (req, res) => {
  const { email, password, plan } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  const db = await getDb();
  const existing = await db.collection("users").findOne({ email });
  if (existing)
    return res.status(400).json({ error: "Email already in use" });
  const hashed = hashPassword(password);
  const token = generateToken();
  const slug = generateSlug(email);
  const result = await db.collection("users").insertOne({

...(truncated)...
