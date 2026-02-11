// server/index.js
require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");

const { connectDB, Admin, User, Ticket, Notification } = require("./db");
const { signAdmin, signUser, requireAdmin, requireUser } = require("./auth");
const { sendEmail, smtpConfigured } = require("./mailer");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_, res) => res.json({ ok: true }));

const loginLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
});

// ===== Helpers =====
function escapeHtml(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function mapTicket(t) {
    return {
        id: String(t._id),
        ticket_no: t.ticket_no,
        title: t.title,
        description: t.description,
        requester_name: t.requester_name || null,
        requester_email: t.requester_email || null,
        priority: t.priority,
        status: t.status,
        assigned_to: t.assigned_to || null,
        created_at: t.created_at,
        updated_at: t.updated_at
    };
}

function mapUser(u) {
    return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        must_reset_password: !!u.must_reset_password,
        created_at: u.created_at,
        updated_at: u.updated_at
    };
}

function mapNotification(n) {
    return {
        id: String(n._id),
        kind: n.kind,
        title: n.title,
        description: n.description,
        read: !!n.read,
        created_at: n.created_at,
        ticket_id: n.ticket_id ? String(n.ticket_id) : null,
        user_id: n.user_id ? String(n.user_id) : null,
        replies: (n.replies || []).map((r) => ({
            from_role: r.from_role,
            message: r.message,
            created_at: r.created_at
        }))
    };
}

// ✅ trava acesso se o usuário precisa redefinir senha
function blockIfMustReset(req, res, next) {
    if (req.user?.must_reset_password) {
        return res.status(403).json({ ok: false, error: "must_reset_password" });
    }
    next();
}

// ===== Admin Auth =====
app.post("/api/admin/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ ok: false, error: "missing_fields" });

        const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() }).lean();
        if (!admin) return res.status(401).json({ ok: false, error: "invalid_credentials" });

        const ok = await bcrypt.compare(password, admin.password_hash);
        if (!ok) return res.status(401).json({ ok: false, error: "invalid_credentials" });

        const token = signAdmin(admin);
        return res.json({ ok: true, token, admin: { id: String(admin._id), name: admin.name, email: admin.email } });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ===== ADMIN USERS (CRUD) =====
app.get("/api/users", requireAdmin, async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const filter = {};

        if (q) {
            const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rgx = new RegExp(safe, "i");
            filter.$or = [{ name: rgx }, { email: rgx }];
        }

        const users = await User.find(filter).sort({ created_at: -1 }).limit(300).lean();

        return res.json({
            ok: true,
            users: users.map((u) => ({
                id: String(u._id),
                name: u.name,
                email: u.email,
                must_reset_password: !!u.must_reset_password,
                created_at: u.created_at,
                updated_at: u.updated_at
            }))
        });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.post("/api/users", requireAdmin, async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        const email = String(req.body?.email || "").trim().toLowerCase();
        const password = String(req.body?.password || "").trim();

        if (!name || !email || !password) {
            return res.status(400).json({ ok: false, error: "missing_fields" });
        }

        const mustReset = password === "123456";
        const hash = await bcrypt.hash(password, 12);

        const user = await User.create({
            name,
            email,
            password_hash: hash,
            must_reset_password: mustReset
        });

        return res.status(201).json({
            ok: true,
            user: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                must_reset_password: !!user.must_reset_password,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
    } catch (e) {
        // E11000 duplicate key error (email duplicado)
        if (String(e?.code) === "11000") {
            return res.status(409).json({ ok: false, error: "email_already_exists" });
        }
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
        const update = {};

        if (req.body?.name != null) {
            const v = String(req.body.name).trim();
            if (!v) return res.status(400).json({ ok: false, error: "invalid_name" });
            update.name = v;
        }

        if (req.body?.email != null) {
            const v = String(req.body.email).trim().toLowerCase();
            if (!v) return res.status(400).json({ ok: false, error: "invalid_email" });
            update.email = v;
        }

        if (req.body?.password != null) {
            const p = String(req.body.password).trim();
            if (!p || p.length < 6) return res.status(400).json({ ok: false, error: "weak_password" });

            update.password_hash = await bcrypt.hash(p, 12);
            update.must_reset_password = (p === "123456"); // se admin setar 123456, volta a exigir reset
        }

        if (req.body?.must_reset_password != null) {
            update.must_reset_password = !!req.body.must_reset_password;
        }

        if (!Object.keys(update).length) {
            return res.status(400).json({ ok: false, error: "nothing_to_update" });
        }

        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
        if (!user) return res.status(404).json({ ok: false, error: "not_found" });

        return res.json({
            ok: true,
            user: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                must_reset_password: !!user.must_reset_password,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
    } catch (e) {
        if (String(e?.code) === "11000") {
            return res.status(409).json({ ok: false, error: "email_already_exists" });
        }
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
        const u = await User.findByIdAndDelete(req.params.id).lean();
        if (!u) return res.status(404).json({ ok: false, error: "not_found" });

        // opcional: limpar notificações do usuário
        await Notification.deleteMany({ recipient_email: u.email });

        return res.json({ ok: true });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// Notificar usuário (e-mail + notificação no sistema)
app.post("/api/users/:id/notify", requireAdmin, async (req, res) => {
    try {
        const title = String(req.body?.title || "").trim();
        const description = String(req.body?.description || "").trim();

        if (!title || !description) {
            return res.status(400).json({ ok: false, error: "missing_fields" });
        }

        const u = await User.findById(req.params.id).lean();
        if (!u) return res.status(404).json({ ok: false, error: "not_found" });

        const notif = await Notification.create({
            recipient_email: u.email,
            kind: "user",
            user_id: u._id,
            title,
            description
        });

        const subject = `[Maximum Atlas] ${title}`;
        const text = `Olá, ${u.name}!\n\n${description}\n\n— Maximum Atlas`;
        const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;">
        <h2 style="margin:0 0 8px;">${escapeHtml(subject)}</h2>
        <p style="margin:0 0 14px;">Olá, <strong>${escapeHtml(u.name)}</strong>!</p>
        <div style="padding:12px 14px;border-radius:12px;background:#f9f1f4;border:1px solid rgba(110,21,51,.15);">
          ${escapeHtml(description).replaceAll("\n", "<br/>")}
        </div>
        <p style="margin:14px 0 0;color:#6a6f7b;">— Maximum Atlas</p>
      </div>
    `;

        const emailResult = await sendEmail({ to: u.email, subject, text, html });

        return res.json({
            ok: true,
            notification: {
                id: String(notif._id),
                title: notif.title,
                description: notif.description,
                read: !!notif.read,
                created_at: notif.created_at
            },
            email: emailResult
        });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.get("/api/admin/me", requireAdmin, async (req, res) => {
    return res.json({ ok: true, admin: req.admin });
});

// ===== User Auth =====
app.post("/api/user/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ ok: false, error: "missing_fields" });

        const user = await User.findOne({ email: String(email).toLowerCase().trim() }).lean();
        if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ ok: false, error: "invalid_credentials" });

        const token = signUser(user);
        return res.json({
            ok: true,
            token,
            user: { id: String(user._id), name: user.name, email: user.email, must_reset_password: !!user.must_reset_password }
        });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ✅ usado pelo dashboard para exibir nome + saber se deve abrir modal obrigatório
app.get("/api/user/me", requireUser, async (req, res) => {
    try {
        const u = await User.findById(req.user.sub).lean();
        if (!u) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, user: mapUser(u) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ✅ redefinição obrigatória
app.post("/api/user/reset-password", requireUser, async (req, res) => {
    try {
        const { new_password } = req.body || {};
        const np = String(new_password || "").trim();

        if (!np || np.length < 6) return res.status(400).json({ ok: false, error: "weak_password" });
        if (np === "123456") return res.status(400).json({ ok: false, error: "password_not_allowed" });

        const hash = await bcrypt.hash(np, 12);

        const updated = await User.findByIdAndUpdate(
            req.user.sub,
            { password_hash: hash, must_reset_password: false },
            { new: true }
        ).lean();

        if (!updated) return res.status(404).json({ ok: false, error: "not_found" });

        const token = signUser(updated);
        return res.json({ ok: true, token, user: mapUser(updated) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ===== Dashboard Summary (Admin) =====
app.get("/api/dashboard/summary", requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const days = Math.max(7, Math.min(30, Number(req.query.days || 14)));
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const [byStatusAgg, byPriorityAgg, dailyAgg, usersTotal, usersMustReset] = await Promise.all([
            Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Ticket.aggregate([{ $group: { _id: "$priority", count: { $sum: 1 } } }]),
            Ticket.aggregate([
                { $match: { created_at: { $gte: start } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } }, created: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            User.countDocuments({}),
            User.countDocuments({ must_reset_password: true })
        ]);

        const countsByStatus = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
        for (const row of byStatusAgg) if (countsByStatus[row._id] != null) countsByStatus[row._id] = row.count;

        const countsByPriority = { low: 0, normal: 0, high: 0, urgent: 0 };
        for (const row of byPriorityAgg) if (countsByPriority[row._id] != null) countsByPriority[row._id] = row.count;

        return res.json({
            ok: true,
            countsByStatus,
            countsByPriority,
            dailyCreated: dailyAgg.map((d) => ({ date: d._id, created: d.created })),
            users: { total: usersTotal, must_reset_password: usersMustReset },
            smtpConfigured: smtpConfigured()
        });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ===== Tickets (Admin) =====
app.get("/api/tickets", requireAdmin, async (req, res) => {
    try {
        const status = (req.query.status || "").toString().trim();
        const priority = (req.query.priority || "").toString().trim();
        const q = (req.query.q || "").toString().trim();

        const filter = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        if (q) {
            const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rgx = new RegExp(safe, "i");
            filter.$or = [{ title: rgx }, { description: rgx }, { requester_name: rgx }, { requester_email: rgx }, { assigned_to: rgx }];
        }

        const tickets = await Ticket.find(filter).sort({ created_at: -1 }).limit(200).lean();
        return res.json({ ok: true, tickets: tickets.map(mapTicket) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.post("/api/tickets/admin", requireAdmin, async (req, res) => {
    try {
        const { title, description, requester_name, requester_email, priority, status, assigned_to } = req.body || {};
        if (!title || !description) return res.status(400).json({ ok: false, error: "missing_fields" });

        const allowedPriority = new Set(["low", "normal", "high", "urgent"]);
        const allowedStatus = new Set(["open", "in_progress", "resolved", "closed"]);

        const t = await Ticket.create({
            title: String(title).trim(),
            description: String(description).trim(),
            requester_name: requester_name ? String(requester_name).trim() : undefined,
            requester_email: requester_email ? String(requester_email).trim().toLowerCase() : undefined,
            priority: allowedPriority.has(priority) ? priority : "normal",
            status: allowedStatus.has(status) ? status : "open",
            assigned_to: assigned_to ? String(assigned_to).trim() : undefined
        });

        return res.status(201).json({ ok: true, ticket: mapTicket(t.toObject()) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.patch("/api/tickets/:id", requireAdmin, async (req, res) => {
    try {
        const { status, priority, assigned_to, title, description, requester_name, requester_email } = req.body || {};
        const allowedStatus = new Set(["open", "in_progress", "resolved", "closed"]);
        const allowedPriority = new Set(["low", "normal", "high", "urgent"]);

        const update = {};

        if (status != null) {
            if (!allowedStatus.has(status)) return res.status(400).json({ ok: false, error: "invalid_status" });
            update.status = status;
        }
        if (priority != null) {
            if (!allowedPriority.has(priority)) return res.status(400).json({ ok: false, error: "invalid_priority" });
            update.priority = priority;
        }
        if (assigned_to != null) update.assigned_to = String(assigned_to).trim() || undefined;

        if (title != null) {
            const v = String(title).trim();
            if (!v) return res.status(400).json({ ok: false, error: "invalid_title" });
            update.title = v;
        }
        if (description != null) {
            const v = String(description).trim();
            if (!v) return res.status(400).json({ ok: false, error: "invalid_description" });
            update.description = v;
        }
        if (requester_name != null) update.requester_name = String(requester_name).trim() || undefined;
        if (requester_email != null) update.requester_email = String(requester_email).trim().toLowerCase() || undefined;

        if (!Object.keys(update).length) return res.status(400).json({ ok: false, error: "nothing_to_update" });

        const t = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
        if (!t) return res.status(404).json({ ok: false, error: "not_found" });

        return res.json({ ok: true, ticket: mapTicket(t) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.delete("/api/tickets/:id", requireAdmin, async (req, res) => {
    try {
        const t = await Ticket.findByIdAndDelete(req.params.id).lean();
        if (!t) return res.status(404).json({ ok: false, error: "not_found" });

        await Notification.deleteMany({ kind: "ticket", ticket_id: t._id });
        return res.json({ ok: true });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.post("/api/tickets/:id/notify", requireAdmin, async (req, res) => {
    try {
        const { title, description } = req.body || {};
        if (!title || !description) return res.status(400).json({ ok: false, error: "missing_fields" });

        const t = await Ticket.findById(req.params.id).lean();
        if (!t) return res.status(404).json({ ok: false, error: "not_found" });

        const recipient = (t.requester_email || "").trim().toLowerCase();
        if (!recipient) return res.status(400).json({ ok: false, error: "ticket_missing_requester_email" });

        const notif = await Notification.create({
            recipient_email: recipient,
            kind: "ticket",
            ticket_id: t._id,
            title: String(title).trim(),
            description: String(description).trim()
        });

        const subject = `[Chamado #${t.ticket_no}] ${String(title).trim()}`;
        const text = `Olá${t.requester_name ? `, ${t.requester_name}` : ""}!\n\n${String(description).trim()}\n\n— Maximum Atlas`;
        const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;">
        <h2 style="margin:0 0 8px;">${escapeHtml(subject)}</h2>
        <p style="margin:0 0 14px;">Olá${t.requester_name ? `, <strong>${escapeHtml(t.requester_name)}</strong>` : ""}!</p>
        <div style="padding:12px 14px;border-radius:12px;background:#f9f1f4;border:1px solid rgba(110,21,51,.15);">
          ${escapeHtml(String(description).trim()).replaceAll("\n", "<br/>")}
        </div>
        <p style="margin:14px 0 0;color:#6a6f7b;">— Maximum Atlas</p>
      </div>
    `;

        const emailResult = await sendEmail({ to: recipient, subject, text, html });

        return res.json({ ok: true, notification: mapNotification(notif.toObject()), email: emailResult });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ===== ✅ USER TICKETS (NÃO EXISTIA) =====
app.get("/api/user/tickets", requireUser, blockIfMustReset, async (req, res) => {
    try {
        const q = (req.query.q || "").toString().trim();
        const status = (req.query.status || "").toString().trim();
        const priority = (req.query.priority || "").toString().trim();

        const filter = { requester_email: String(req.user.email || "").toLowerCase() };
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        if (q) {
            const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rgx = new RegExp(safe, "i");
            filter.$or = [{ title: rgx }, { description: rgx }];
        }

        const tickets = await Ticket.find(filter).sort({ created_at: -1 }).limit(200).lean();
        return res.json({ ok: true, tickets: tickets.map(mapTicket) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.post("/api/user/tickets", requireUser, blockIfMustReset, async (req, res) => {
    try {
        const { title, description, priority } = req.body || {};
        if (!title || !description) return res.status(400).json({ ok: false, error: "missing_fields" });

        const allowedPriority = new Set(["low", "normal", "high", "urgent"]);

        const u = await User.findById(req.user.sub).lean();
        if (!u) return res.status(404).json({ ok: false, error: "not_found" });

        const t = await Ticket.create({
            title: String(title).trim(),
            description: String(description).trim(),
            requester_name: u.name,
            requester_email: u.email,
            priority: allowedPriority.has(priority) ? priority : "normal",
            status: "open"
        });

        return res.status(201).json({ ok: true, ticket: mapTicket(t.toObject()) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ===== ✅ USER NOTIFICATIONS (NÃO EXISTIA) =====
app.get("/api/user/notifications", requireUser, blockIfMustReset, async (req, res) => {
    try {
        const q = (req.query.q || "").toString().trim();
        const filterRead = (req.query.filter || "").toString().trim(); // unread/read/""
        const email = String(req.user.email || "").toLowerCase();

        const filter = { recipient_email: email };
        if (filterRead === "unread") filter.read = false;
        if (filterRead === "read") filter.read = true;

        if (q) {
            const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rgx = new RegExp(safe, "i");
            filter.$or = [{ title: rgx }, { description: rgx }];
        }

        const notifications = await Notification.find(filter).sort({ created_at: -1 }).limit(400).lean();
        return res.json({ ok: true, notifications: notifications.map(mapNotification) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.patch("/api/user/notifications/:id/read", requireUser, blockIfMustReset, async (req, res) => {
    try {
        const email = String(req.user.email || "").toLowerCase();

        const n = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient_email: email },
            { $set: { read: true } },
            { new: true }
        ).lean();

        if (!n) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, notification: mapNotification(n) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

app.post("/api/user/notifications/mark-all-read", requireUser, blockIfMustReset, async (req, res) => {
    try {
        const email = String(req.user.email || "").toLowerCase();
        await Notification.updateMany({ recipient_email: email, read: false }, { $set: { read: true } });
        return res.json({ ok: true });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ✅ responder dentro do sistema
app.post("/api/user/notifications/:id/reply", requireUser, blockIfMustReset, async (req, res) => {
    try {
        const email = String(req.user.email || "").toLowerCase();
        const message = String(req.body?.message || "").trim();
        if (!message) return res.status(400).json({ ok: false, error: "missing_message" });

        const n = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient_email: email },
            {
                $push: { replies: { from_role: "user", message, created_at: new Date() } },
                $set: { read: true }
            },
            { new: true }
        ).lean();

        if (!n) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, notification: mapNotification(n) });
    } catch {
        return res.status(500).json({ ok: false, error: "server_error" });
    }
});

// ===== Seed =====
async function seedAdminAndSamples() {
    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "";
    const adminName = process.env.ADMIN_NAME || "Administrador";

    if (adminEmail && adminPassword) {
        const exists = await Admin.findOne({ email: adminEmail }).lean();
        if (!exists) {
            const hash = await bcrypt.hash(adminPassword, 12);
            await Admin.create({ name: adminName, email: adminEmail, password_hash: hash });
            console.log(`[seed] admin criado: ${adminEmail}`);
        }
    }

    const anyTicket = await Ticket.findOne({}).lean();
    if (!anyTicket) {
        await Ticket.create([
            {
                title: "Erro ao acessar o portal",
                description: "Usuário relata tela branca ao logar.",
                requester_name: "Carlos Lima",
                requester_email: "carlos@empresa.com",
                priority: "high",
                status: "open"
            }
        ]);
        console.log("[seed] tickets de exemplo criados");
    }

    const anyUser = await User.findOne({}).lean();
    if (!anyUser) {
        const pw1 = await bcrypt.hash("123456", 12);
        await User.create([
            { name: "Usuário Padrão", email: "usuario@empresa.com", password_hash: pw1, must_reset_password: true }
        ]);
        console.log("[seed] users de exemplo criados");
    }
}

(async () => {
    if (!process.env.JWT_SECRET) {
        console.error("Faltou JWT_SECRET no .env.");
        process.exit(1);
    }

    await connectDB();
    await seedAdminAndSamples();

    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => console.log(`Server on :${port}`));
})();
