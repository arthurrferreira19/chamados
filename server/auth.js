// server/auth.js
const jwt = require("jsonwebtoken");

function signAdmin(admin) {
  const payload = { sub: String(admin._id || admin.id), email: admin.email, name: admin.name, role: "admin" };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "12h" });
}

function signUser(user) {
  const payload = {
    sub: String(user._id || user.id),
    email: user.email,
    name: user.name,
    role: "user",
    must_reset_password: !!user.must_reset_password
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "12h" });
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "missing_token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ ok: false, error: "forbidden" });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}

function requireUser(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "missing_token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "user") return res.status(403).json({ ok: false, error: "forbidden" });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}

module.exports = { signAdmin, signUser, requireAdmin, requireUser };
