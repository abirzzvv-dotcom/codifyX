const jwt = require("jsonwebtoken");
const { pool } = require("../db");

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT id, username, email, role, verified, suspended FROM users WHERE id = $1",
      [decoded.userId]
    );
    if (!rows[0]) return res.status(401).json({ error: "User not found" });
    if (rows[0].suspended) return res.status(403).json({ error: "Account suspended" });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
