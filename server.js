require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "site-data.json");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const LOG_FILE = path.join(DATA_DIR, "activity-logs.json");
const USERS_FILE = path.join(DATA_DIR, "discord-users.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = {
  products: [
    { id: "p1", name: "EGO Rifle", nameAr: "سلاح EGO", category: "Weapons", categoryAr: "أسلحة", price: "Contact us", image: "", description: "Add your weapon details here.", descriptionAr: "أضف تفاصيل السلاح هنا.", vip: false },
    { id: "p2", name: "EGO VIP Car", nameAr: "سيارة VIP", category: "Cars", categoryAr: "سيارات", price: "VIP", image: "", description: "VIP vehicle offer.", descriptionAr: "عرض سيارة VIP.", vip: true }
  ],
  streamers: [],
  staff: [],
  applications: [],
  purchaseRequests: [],
  rules: [
    { en: "Respect all players and staff.", ar: "احترم جميع اللاعبين وأعضاء الستاف." },
    { en: "No cheating, exploits, or unfair advantages.", ar: "ممنوع الغش أو استغلال الثغرات أو استعمال أفضلية غير عادلة." },
    { en: "Follow staff instructions during disputes.", ar: "اتبع تعليمات الستاف عند حدوث أي خلاف." },
    { en: "Keep chat and voice channels respectful.", ar: "حافظ على الاحترام في الدردشة والقنوات الصوتية." }
  ],
  announcements: [], maintenanceMode: false,
  settings: { discordInvite: "", accent: "#ff2424", font: "Orbitron", siteTitle: "EGO PvP", heroTitle: "FIGHT WITHOUT LIMITS.", heroSubtitle: "Skill. Precision. Respect. Welcome to EGO PvP — your arena, your legacy.", logoUrl: "", bannerUrl: "", applicationEnabled: true, maintenanceMessage: "We will be back soon." }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    console.error("Could not read site data:", e.message);
    return JSON.parse(JSON.stringify(defaultData));
  }
}
let data = loadData();
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function loadDiscordUsers() { try { return fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE,"utf8")) : []; } catch { return []; } }
let discordUsers = loadDiscordUsers();
function saveDiscordUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(discordUsers,null,2), {mode:0o600}); }
function loadAccounts() {
  try { return fs.existsSync(ACCOUNTS_FILE) ? JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8")) : []; }
  catch (e) { console.error("Could not read accounts:", e.message); return []; }
}
let accounts = loadAccounts();
function saveAccounts() { fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), { mode: 0o600 }); }
function addLog(event, req, account = null, details = "") {
  let logs=[]; try { if(fs.existsSync(LOG_FILE)) logs=JSON.parse(fs.readFileSync(LOG_FILE,"utf8")); } catch {}
  logs.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), event, username: account?.username || "visitor", role: account?.role || "visitor", path: clean(req.originalUrl || req.path, 180).split("?")[0], details: clean(details, 240) });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(0,5000),null,2), {mode:0o600});
}
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(String(password), salt, 64).toString("hex") });
const verifyPassword = (password, account) => { try { const actual = crypto.scryptSync(String(password), account.salt, 64); return crypto.timingSafeEqual(actual, Buffer.from(account.passwordHash, "hex")); } catch { return false; } };
// Create the first Project Creator account from environment variables only when no accounts exist.
if (!accounts.length) {
  const creatorPassword = process.env.PROJECT_CREATOR_PASSWORD || process.env.ADMIN_PASSWORD;
  if (creatorPassword) {
    const username = String(process.env.PROJECT_CREATOR_USERNAME || "creator").trim().slice(0, 40).toLowerCase();
    const pw = hashPassword(creatorPassword);
    accounts.push({ id: crypto.randomUUID(), username, displayName: "Project Creator", role: "creator", salt: pw.salt, passwordHash: pw.hash, licenseExpiresAt: null, licenseStatus: "active", createdAt: new Date().toISOString(), profile: {} });
    saveAccounts();
    console.log(`Bootstrapped Project Creator account: ${username}`);
  }
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "30kb" }));
if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error("Set SESSION_SECRET to a random value of at least 32 characters in production.");
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "public")));

const requireAuth = (req, res, next) => {
  const account = accounts.find(a => a.id === req.session?.accountId) || (req.session?.discordAdmin ? { id: `discord:${req.session.discordAdmin.id}`, username: req.session.discordAdmin.username, displayName: req.session.discordAdmin.username, role: "owner", licenseStatus: "active", licenseExpiresAt: null, profile: {} } : null);
  if (!account) return res.status(401).json({ error: "Please sign in." });
  if (!req.session?.discordAdmin && account.role !== "creator" && (account.licenseStatus !== "active" || !account.licenseExpiresAt || Date.parse(account.licenseExpiresAt) <= Date.now())) {
    if (account.licenseStatus === "active") { account.licenseStatus = "expired"; saveAccounts(); }
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Your license has expired or been suspended. Contact the Project Creator." });
  }
  req.account = account;
  next();
};
const allowRoles = (...roles) => (req, res, next) => requireAuth(req, res, () => roles.includes(req.account.role) ? next() : res.status(403).json({ error: "You don't have permission to access this feature." }));
const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const safeImage = (v) => {
  const s = clean(v, 2_100_000);
  if (!s) return "";
  if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 2_100_000) return s;
  return safeUrl(s);
};
const safeUrl = (v) => {
  const s = clean(v, 1000);
  if (!s) return "";
  try { const u = new URL(s); return ["http:", "https:"].includes(u.protocol) ? s : ""; } catch { return ""; }
};

app.get("/api/site", (req, res) => {
  res.json({
    products: data.products,
    streamers: data.streamers,
    staff: data.staff || [],
    rules: data.rules,
    settings: data.settings,
    announcements: data.announcements || [], maintenanceMode: Boolean(data.maintenanceMode),
    discordLoginEnabled: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
  });
});

app.post("/api/activity/visit", (req,res) => {
  const event = req.body?.event === "exit" ? "site_exit" : "site_enter";
  addLog(event, req, null, clean(req.body?.page, 100)); res.json({ok:true});
});

app.post("/api/apply-staff", async (req, res) => {
  if (data.settings?.applicationEnabled === false) return res.status(403).json({ error: "Staff applications are currently closed." });
  if (data.settings?.applicationEnabled === false) return res.status(403).json({ error: "Staff applications are currently closed." });
  const name = clean(req.body.name, 80);
  const nickname = clean(req.body.nickname, 80);
  const age = clean(req.body.age, 3);
  const discordId = clean(req.body.discordId, 40);
  const reason = clean(req.body.reason, 1500);
  const honeypot = clean(req.body.company, 100);
  if (honeypot) return res.json({ ok: true });
  if (!name || !nickname || !age || !discordId || !reason) return res.status(400).json({ error: "Please fill in every field." });
  if (!/^\d{1,3}$/.test(age) || Number(age) < 13 || Number(age) > 99) return res.status(400).json({ error: "Please enter a valid age." });
  if (!/^\d{15,22}$/.test(discordId)) return res.status(400).json({ error: "Discord ID should contain 15–22 digits." });
  data.applications = data.applications || [];
  const application = { id: crypto.randomUUID(), name, nickname, age: Number(age), discordId, reason, status: "pending", createdAt: new Date().toISOString() };
  data.applications.unshift(application); saveData();
  if (!process.env.STAFF_WEBHOOK_URL) return res.json({ ok: true, message: "Application saved successfully." });
  const payload = {
    username: "EGO PvP • Staff Applications",
    embeds: [{
      title: "📝 New Staff Application",
      color: 16720932,
      fields: [
        { name: "Name", value: name, inline: true },
        { name: "Nickname", value: nickname, inline: true },
        { name: "Age", value: age, inline: true },
        { name: "Discord ID", value: discordId, inline: false },
        { name: "Why do you want to join the staff team?", value: reason, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "EGO PvP • Website" }
    }]
  };
  try {
    const r = await fetch(process.env.STAFF_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error("Discord webhook returned " + r.status);
    res.json({ ok: true, message: "Application sent successfully." });
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Could not send the application to Discord. Check the staff webhook." }); }
});

app.post("/api/shop-request", async (req, res) => {
  const item = clean(req.body.item, 120);
  const player = clean(req.body.player || req.body.playerName, 80);
  const discordId = clean(req.body.discordId || req.body.discord, 100);
  const message = clean(req.body.message, 1000);
  if (!item || !player || !discordId) return res.status(400).json({ error: "Please fill in all fields." });
  if (!/^\d{15,22}$/.test(discordId)) return res.status(400).json({ error: "Discord ID should contain 15–22 digits." });
  data.purchaseRequests = data.purchaseRequests || [];
  data.purchaseRequests.unshift({ id: crypto.randomUUID(), item, player, discordId, message, status: "pending", createdAt: new Date().toISOString() }); saveData();
  if (!process.env.SHOP_WEBHOOK_URL) return res.json({ ok: true, message: "Request saved successfully." });
  try {
    const r = await fetch(process.env.SHOP_WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "EGO PvP • Shop", embeds: [{ title: "🛒 New Shop Request", color: 16720932, fields: [
        { name: "Item", value: item, inline: true }, { name: "Player", value: player, inline: true }, { name: "Discord ID", value: discordId }
      ], timestamp: new Date().toISOString() }] })
    });
    if (!r.ok) throw new Error("Discord webhook returned " + r.status);
    res.json({ ok: true, message: "Request sent successfully." });
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Could not send the shop request to Discord." }); }
});

const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many login attempts. Please wait 15 minutes and try again." } });
app.post("/api/admin/login", adminLoginLimiter, (req, res) => {
  const username = clean(req.body.username, 40).toLowerCase();
  const password = String(req.body.password || "");
  const account = accounts.find(a => a.username.toLowerCase() === username);
  if (!account || !verifyPassword(password, account)) { addLog("admin_login_failed", req, account, `username=${username}`); return res.status(401).json({ error: "Invalid username or password." }); }
  if (!req.session?.discordAdmin && account.role !== "creator" && (account.licenseStatus !== "active" || !account.licenseExpiresAt || Date.parse(account.licenseExpiresAt) <= Date.now())) {
    if (account.licenseStatus === "active") { account.licenseStatus = "expired"; saveAccounts(); }
    return res.status(403).json({ error: "License expired or suspended. Contact the Project Creator." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start a secure session." });
    req.session.accountId = account.id;
    addLog("admin_login", req, account);
    res.json({ ok: true, user: { username: account.username, role: account.role, displayName: account.displayName } });
  });
});
app.post("/api/admin/logout", requireAuth, (req, res) => { addLog("admin_logout", req, req.account); req.session.destroy(() => res.json({ ok: true })); });
app.post("/api/admin/exit", requireAuth, (req,res) => { addLog("admin_panel_exit",req,req.account); res.json({ok:true}); });
app.get("/api/admin/overview", allowRoles("creator", "owner"), (req,res) => {
  const logs = (()=>{try{return JSON.parse(fs.readFileSync(LOG_FILE,"utf8"))}catch{return []}})();
  const apps = data.applications || [], orders = data.purchaseRequests || [];
  res.json({ stats: { registeredUsers: discordUsers.length, staffMembers: (data.staff||[]).length, pendingApplications: apps.filter(x=>x.status==="pending"||!x.status).length, pendingOrders: orders.filter(x=>x.status==="pending"||!x.status).length, websiteVisits: logs.filter(x=>x.event==="site_enter").length, discordConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET), fivemConfigured: Boolean(process.env.FIVEM_STATUS_URL), fivemAvailable: false }, recentActivity: logs.slice(0,12).map(x=>({at:x.at,event:x.event,username:x.username,role:x.role,details:x.details})) });
});
app.get("/api/creator/users", allowRoles("creator"), (req,res) => {
  const q=clean(req.query.q,100).toLowerCase(); let users=discordUsers;
  if(q) users=users.filter(u=>String(u.username||"").toLowerCase().includes(q)||String(u.id||"").includes(q));
  res.json({users:users.slice(0,500).map(u=>({id:u.id,username:u.username,avatar:u.avatar,firstSeenAt:u.firstSeenAt,lastSeenAt:u.lastSeenAt,status:u.status||"active",moderationNote:u.moderationNote||""}))});
});
app.patch("/api/creator/users/:id", allowRoles("creator"), (req,res) => {
  const u=discordUsers.find(x=>x.id===req.params.id); if(!u) return res.status(404).json({error:"Discord user not found in the registered-user directory."});
  const status=clean(req.body.status,20); if(!["active","suspended","banned"].includes(status)) return res.status(400).json({error:"Invalid account status."});
  u.status=status; u.moderationNote=clean(req.body.note,500); u.updatedAt=new Date().toISOString(); saveDiscordUsers(); addLog("discord_user_"+status,req,req.account,`target=${u.id} username=${u.username}`); res.json({ok:true,user:{id:u.id,status:u.status}});
});
app.put("/api/admin/content", allowRoles("creator","owner"), (req,res) => {
  if(!Array.isArray(req.body.announcements)||req.body.announcements.length>30) return res.status(400).json({error:"Invalid announcements."});
  data.announcements=req.body.announcements.map(a=>({id:clean(a.id,80)||crypto.randomUUID(),title:clean(a.title,120),body:clean(a.body,1000),active:Boolean(a.active),createdAt:a.createdAt||new Date().toISOString()})).filter(a=>a.title&&a.body);
  data.maintenanceMode=Boolean(req.body.maintenanceMode); data.settings.applicationEnabled=req.body.applicationEnabled!==false; data.settings.maintenanceMessage=clean(req.body.maintenanceMessage||"We will be back soon.",300); saveData(); addLog("website_content_updated",req,req.account); res.json({ok:true,announcements:data.announcements,maintenanceMode:data.maintenanceMode,settings:data.settings});
});
app.get("/api/creator/logs", allowRoles("creator"), (req,res) => { let logs=[]; try { if(fs.existsSync(LOG_FILE)) logs=JSON.parse(fs.readFileSync(LOG_FILE,"utf8")); } catch {} res.json({logs:logs.slice(0,1000)}); });
app.get("/api/admin/status", (req, res) => {
  if (req.session?.discordAdmin) return res.json({ authenticated: true, discordAdminLoginEnabled: true, user: { id: `discord:${req.session.discordAdmin.id}`, username: req.session.discordAdmin.username, displayName: req.session.discordAdmin.username, role: "owner", profile: {}, discord: true } });
  const a = accounts.find(x => x.id === req.session?.accountId);
  if (!a) return res.json({ authenticated: false, discordAdminLoginEnabled: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID && process.env.DISCORD_ADMIN_ROLE_ID) });
  if (a.role !== "creator" && (a.licenseStatus !== "active" || !a.licenseExpiresAt || Date.parse(a.licenseExpiresAt) <= Date.now())) {
    if (a.licenseStatus === "active") { a.licenseStatus = "expired"; saveAccounts(); }
    req.session.destroy(() => {}); return res.json({ authenticated: false, error: "License expired or suspended." });
  }
  res.json({ authenticated: true, discordAdminLoginEnabled: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID && process.env.DISCORD_ADMIN_ROLE_ID), user: { id: a.id, username: a.username, role: a.role, displayName: a.displayName, licenseExpiresAt: a.licenseExpiresAt, profile: a.profile || {} } });
});
app.get("/api/creator/accounts", allowRoles("creator"), (req, res) => {
  let changed = false;
  accounts.forEach(a => { if (a.role !== "creator" && a.licenseStatus === "active" && (!a.licenseExpiresAt || Date.parse(a.licenseExpiresAt) <= Date.now())) { a.licenseStatus = "expired"; changed = true; } });
  if (changed) saveAccounts();
  res.json({ accounts: accounts.filter(a => a.role !== "creator").map(({ id, username, displayName, role, licenseExpiresAt, licenseStatus, createdAt, profile }) => ({ id, username, displayName, role, licenseExpiresAt, licenseStatus, createdAt, profile })) });
});
app.post("/api/creator/accounts", allowRoles("creator"), (req, res) => {
  const username = clean(req.body.username, 40).toLowerCase();
  const displayName = clean(req.body.displayName || username, 80);
  const password = String(req.body.password || "");
  const role = req.body.role;
  const days = Number(req.body.days);
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return res.status(400).json({ error: "Username must be 3–40 characters: letters, numbers, dot, dash or underscore." });
  if (accounts.some(a => a.username.toLowerCase() === username)) return res.status(409).json({ error: "That username already exists." });
  if (!password || password.length < 10 || password.length > 200) return res.status(400).json({ error: "Password must be 10–200 characters." });
  if (!["owner", "streamer"].includes(role)) return res.status(400).json({ error: "Role must be Owner or Streamer." });
  if (!Number.isInteger(days) || days < 1 || days > 3650) return res.status(400).json({ error: "License duration must be 1–3650 days." });
  const pw = hashPassword(password), expires = new Date(Date.now() + days * 86400000).toISOString();
  const a = { id: crypto.randomUUID(), username, displayName, role, salt: pw.salt, passwordHash: pw.hash, licenseExpiresAt: expires, licenseStatus: "active", createdAt: new Date().toISOString(), profile: { name: displayName, banner: "", streamUrl: "", live: false } };
  accounts.push(a); saveAccounts();
  res.status(201).json({ ok: true, account: { id: a.id, username, displayName, role, licenseExpiresAt: expires, licenseStatus: a.licenseStatus } });
});
app.patch("/api/creator/accounts/:id/license", allowRoles("creator"), (req, res) => {
  const a = accounts.find(x => x.id === req.params.id && x.role !== "creator");
  if (!a) return res.status(404).json({ error: "Account not found." });
  const action = req.body.action;
  if (action === "suspend") a.licenseStatus = "suspended";
  else if (action === "activate") { if (!a.licenseExpiresAt || Date.parse(a.licenseExpiresAt) <= Date.now()) return res.status(400).json({ error: "Extend the expired license before activating it." }); a.licenseStatus = "active"; }
  else if (action === "extend") { const days = Number(req.body.days); if (!Number.isInteger(days) || days < 1 || days > 3650) return res.status(400).json({ error: "Extension must be 1–3650 days." }); const base = Math.max(Date.now(), Date.parse(a.licenseExpiresAt) || 0); a.licenseExpiresAt = new Date(base + days * 86400000).toISOString(); a.licenseStatus = "active"; }
  else if (action === "delete") accounts = accounts.filter(x => x.id !== a.id);
  else return res.status(400).json({ error: "Unknown license action." });
  saveAccounts(); res.json({ ok: true });
});
app.put("/api/streamer/profile", allowRoles("streamer"), (req, res) => {
  const name = clean(req.body.name || req.account.displayName, 80);
  const banner = safeUrl(req.body.banner);
  const streamUrl = safeUrl(req.body.streamUrl);
  if (req.body.banner && !banner) return res.status(400).json({ error: "Banner must be a valid HTTP(S) URL." });
  if (req.body.streamUrl && !streamUrl) return res.status(400).json({ error: "Stream link must be a valid HTTP(S) URL." });
  req.account.displayName = name;
  req.account.profile = { name, banner, streamUrl, live: Boolean(req.body.live) };
  const existing = data.streamers.find(s => s.accountId === req.account.id);
  const publicStreamer = { id: req.account.id, accountId: req.account.id, name, platform: clean(req.body.platform, 40) || "Live", url: streamUrl, image: banner, live: Boolean(req.body.live) };
  if (existing) Object.assign(existing, publicStreamer); else data.streamers.push(publicStreamer);
  saveAccounts(); saveData(); res.json({ ok: true, profile: req.account.profile });
});

app.put("/api/admin/products", allowRoles("creator", "owner"), (req, res) => {
  if (!Array.isArray(req.body.products) || req.body.products.length > 200) return res.status(400).json({ error: "Invalid product list." });
  data.products = req.body.products.map(p => ({ id: clean(p.id, 80) || "p" + Date.now() + Math.random().toString(16).slice(2, 6), name: clean(p.name, 100), nameAr: clean(p.nameAr, 100), category: clean(p.category, 40), categoryAr: clean(p.categoryAr, 40), price: clean(p.price, 80), image: safeImage(p.image), description: clean(p.description, 500), descriptionAr: clean(p.descriptionAr, 500), vip: Boolean(p.vip) })).filter(p => p.name);
  saveData(); res.json({ ok: true, products: data.products });
});
app.put("/api/admin/streamers", allowRoles("creator"), (req, res) => {
  if (!Array.isArray(req.body.streamers) || req.body.streamers.length > 100) return res.status(400).json({ error: "Invalid streamer list." });
  data.streamers = req.body.streamers.map(s => ({ id: clean(s.id, 80) || "s" + Date.now() + Math.random().toString(16).slice(2, 6), name: clean(s.name, 100), platform: clean(s.platform, 40), url: safeUrl(s.url), image: safeUrl(s.image), live: Boolean(s.live) })).filter(s => s.name && s.url);
  saveData(); res.json({ ok: true, streamers: data.streamers });
});
app.put("/api/admin/settings", allowRoles("creator", "owner"), (req, res) => {
  const old = data.settings || {};
  const font = ["Orbitron","Barlow Condensed","Inter","Cairo","Rajdhani","Oxanium"].includes(req.body.font) ? req.body.font : (old.font || "Orbitron");
  data.settings = { ...old, discordInvite: safeUrl(req.body.discordInvite), accent: /^#[0-9a-fA-F]{6}$/.test(req.body.accent || "") ? req.body.accent : "#ff2424", font,
    siteTitle: clean(req.body.siteTitle || old.siteTitle || "EGO PvP",80), heroTitle: clean(req.body.heroTitle || old.heroTitle || "FIGHT WITHOUT LIMITS.",140), heroSubtitle: clean(req.body.heroSubtitle || old.heroSubtitle || "",300), logoUrl: safeUrl(req.body.logoUrl || ""), bannerUrl: safeUrl(req.body.bannerUrl || "") };
  saveData(); addLog("site_settings_updated",req,req.account); res.json({ ok: true, settings: data.settings });
});
app.put("/api/admin/rules", allowRoles("creator", "owner"), (req, res) => {
  if (!Array.isArray(req.body.rules) || req.body.rules.length > 50) return res.status(400).json({ error: "Invalid rules." });
  data.rules = req.body.rules.map(r => ({ en: clean(r.en, 500), ar: clean(r.ar, 500) })).filter(r => r.en || r.ar);
  saveData(); res.json({ ok: true, rules: data.rules });
});

app.put("/api/admin/staff", allowRoles("creator", "owner"), (req, res) => {
  if (!Array.isArray(req.body.staff) || req.body.staff.length > 100) return res.status(400).json({ error: "Invalid staff list." });
  data.staff = req.body.staff.map((m, i) => ({ id: clean(m.id, 80) || crypto.randomUUID(), name: clean(m.name, 100), role: clean(m.role, 80), description: clean(m.description, 500), image: safeImage(m.image), links: clean(m.links, 500), order: i })).filter(m => m.name && m.role);
  saveData(); res.json({ ok: true, staff: data.staff });
});
app.get("/api/creator/submissions", allowRoles("creator"), (req, res) => res.json({ applications: data.applications || [], purchaseRequests: data.purchaseRequests || [] }));
app.patch("/api/creator/submissions/:type/:id", allowRoles("creator"), (req, res) => {
  const list = req.params.type === "applications" ? (data.applications || []) : req.params.type === "purchases" ? (data.purchaseRequests || []) : null;
  if (!list) return res.status(400).json({ error: "Unknown submission type." });
  const item = list.find(x => x.id === req.params.id); if (!item) return res.status(404).json({ error: "Submission not found." });
  const status = clean(req.body.status, 20); if (!["pending", "accepted", "rejected", "completed"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  item.status = status; item.updatedAt = new Date().toISOString(); saveData(); res.json({ ok: true, item });
});

app.get("/auth/discord/admin", (req,res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID || !process.env.DISCORD_ADMIN_ROLE_ID || !process.env.DISCORD_ADMIN_REDIRECT_URI) return res.redirect("/admin?discordAdmin=not-configured");
  const state=crypto.randomBytes(24).toString("hex"); req.session.discordAdminOAuthState=state;
  const params=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,redirect_uri:process.env.DISCORD_ADMIN_REDIRECT_URI,response_type:"code",scope:"identify",state});
  res.redirect("https://discord.com/oauth2/authorize?"+params.toString());
});
app.get("/auth/discord/admin/callback", async (req,res) => {
  try {
    if (!req.query.code || !req.query.state || !req.session.discordAdminOAuthState || String(req.query.state)!==req.session.discordAdminOAuthState) return res.redirect("/admin?discordAdmin=state-failed");
    delete req.session.discordAdminOAuthState;
    const body=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:"authorization_code",code:String(req.query.code),redirect_uri:process.env.DISCORD_ADMIN_REDIRECT_URI});
    const tr=await fetch("https://discord.com/api/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}); const token=await tr.json(); if(!token.access_token) throw new Error("OAuth token exchange failed");
    const ur=await fetch("https://discord.com/api/users/@me",{headers:{Authorization:"Bearer "+token.access_token}}); const user=await ur.json(); if(!user.id) throw new Error("Could not identify Discord user");
    const mr=await fetch(`https://discord.com/api/guilds/${encodeURIComponent(process.env.DISCORD_GUILD_ID)}/members/${encodeURIComponent(user.id)}`,{headers:{Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`}});
    if(!mr.ok) return res.redirect("/admin?discordAdmin=not-authorized"); const member=await mr.json();
    if(!(member.roles||[]).includes(process.env.DISCORD_ADMIN_ROLE_ID)) return res.redirect("/admin?discordAdmin=not-authorized");
    req.session.regenerate(err=>{if(err) return res.redirect("/admin?discordAdmin=failed");req.session.discordAdmin={id:String(user.id),username:clean(user.global_name||user.username,100)};res.redirect("/admin");});
  } catch(e) { console.error("Discord admin OAuth failed:",e.message); res.redirect("/admin?discordAdmin=failed"); }
});
app.get("/auth/discord", (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) return res.redirect("/?discord=not-configured");
  const state = crypto.randomBytes(24).toString("hex"); req.session.discordOAuthState = state;
  const params = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, redirect_uri: process.env.DISCORD_REDIRECT_URI, response_type: "code", scope: "identify", state });
  res.redirect("https://discord.com/oauth2/authorize?" + params.toString());
});
app.get("/auth/discord/callback", async (req, res) => {
  try {
    if (!req.query.code || !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) return res.redirect("/?discord=failed");
    if (!req.query.state || !req.session.discordOAuthState || String(req.query.state) !== req.session.discordOAuthState) return res.redirect("/?discord=state-failed");
    delete req.session.discordOAuthState;
    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code", code: String(req.query.code),
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    });
    const tokenResp = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const token = await tokenResp.json();
    if (!token.access_token) throw new Error("OAuth token exchange failed");
    const userResp = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token.access_token } });
    const user = await userResp.json();
    const discordUser = { id: String(user.id), username: clean(user.global_name || user.username,100), avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : "" };
    req.session.discordUser = discordUser;
    const existingUser = discordUsers.find(u=>u.id===discordUser.id);
    if(existingUser){ existingUser.username=discordUser.username; existingUser.avatar=discordUser.avatar; existingUser.lastSeenAt=new Date().toISOString(); }
    else discordUsers.unshift({...discordUser,firstSeenAt:new Date().toISOString(),lastSeenAt:new Date().toISOString(),status:"active"});
    saveDiscordUsers(); res.redirect("/");
  } catch (e) { console.error(e.message); res.redirect("/?discord=failed"); }
});
app.get("/api/me", (req, res) => { const user=req.session.discordUser||null; if(user){const record=discordUsers.find(u=>u.id===user.id); if(record&&record.status!=="active") return res.status(403).json({user:null,error:"This website account is suspended or banned."});} res.json({ user }); });
app.get("/api/discord/member", async (req, res) => {
  const user = req.session.discordUser;
  if (!user) return res.status(401).json({ error: "Sign in with Discord first." });
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) return res.status(503).json({ error: "Discord membership lookup is not configured." });
  try {
    const r = await fetch(`https://discord.com/api/guilds/${encodeURIComponent(process.env.DISCORD_GUILD_ID)}/members/${encodeURIComponent(user.id)}`, { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
    if (r.status === 404) return res.json({ member: false, roles: [] });
    if (!r.ok) throw new Error(`Discord API returned ${r.status}`);
    const member = await r.json(); res.json({ member: true, roles: member.roles || [], isConfiguredAdmin: Boolean(process.env.DISCORD_ADMIN_ROLE_ID && (member.roles || []).includes(process.env.DISCORD_ADMIN_ROLE_ID)) });
  } catch (e) { console.error("Discord membership check failed:", e.message); res.status(502).json({ error: "Could not verify Discord membership." }); }
});

app.get("/admin", (req,res) => res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("/admin/", (req,res) => res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`EGO PvP is running at http://localhost:${PORT}`));
