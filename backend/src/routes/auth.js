const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { authenticate } = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/email");

function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "username, email and password required" });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const exists = await pool.query(
      "SELECT id FROM users WHERE email=$1 OR username=$2",
      [email, username]
    );
    if (exists.rows.length > 0)
      return res.status(409).json({ error: "Email or username already taken" });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username, email",
      [username, email, hash]
    );
    const user = rows[0];

    const code = randomCode();
    await pool.query(
      "INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES ($1,$2,'verify', NOW() + INTERVAL '15 minutes')",
      [user.id, code]
    );

    try {
      await sendVerificationEmail(email, username, code);
    } catch (e) {
      console.warn("[Email] Failed to send verification:", e.message);
    }

    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, username, email, verified: false } });
  } catch (err) {
    console.error("[Auth/register]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });
  try {
    const { rows } = await pool.query(
      "SELECT id, username, email, password_hash, role, verified, suspended FROM users WHERE email=$1",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.suspended) return res.status(403).json({ error: "Account suspended" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified,
      },
    });
  } catch (err) {
    console.error("[Auth/login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/verify-email", authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code required" });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM verification_codes WHERE user_id=$1 AND code=$2 AND type='verify' AND expires_at > NOW()",
      [req.user.id, code]
    );
    if (!rows[0]) return res.status(400).json({ error: "Invalid or expired code" });

    await pool.query("UPDATE users SET verified=true WHERE id=$1", [req.user.id]);
    await pool.query("DELETE FROM verification_codes WHERE user_id=$1 AND type='verify'", [req.user.id]);
    res.json({ message: "Email verified" });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/resend-verification", authenticate, async (req, res) => {
  try {
    const code = randomCode();
    await pool.query(
      "DELETE FROM verification_codes WHERE user_id=$1 AND type='verify'",
      [req.user.id]
    );
    await pool.query(
      "INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES ($1,$2,'verify', NOW() + INTERVAL '15 minutes')",
      [req.user.id, code]
    );
    await sendVerificationEmail(req.user.email, req.user.username, code);
    res.json({ message: "Verification email sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send email" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (!rows[0]) return res.json({ message: "If that email exists, a reset code was sent" });

    const code = randomCode();
    await pool.query(
      "DELETE FROM verification_codes WHERE user_id=$1 AND type='reset'",
      [rows[0].id]
    );
    await pool.query(
      "INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES ($1,$2,'reset', NOW() + INTERVAL '15 minutes')",
      [rows[0].id, code]
    );
    try {
      await sendPasswordResetEmail(email, code);
    } catch (e) {
      console.warn("[Email] Reset email failed:", e.message);
    }
    res.json({ message: "If that email exists, a reset code was sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ error: "email, code and newPassword required" });
  if (newPassword.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const { rows: userRows } = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (!userRows[0]) return res.status(400).json({ error: "Invalid request" });
    const userId = userRows[0].id;

    const { rows } = await pool.query(
      "SELECT id FROM verification_codes WHERE user_id=$1 AND code=$2 AND type='reset' AND expires_at > NOW()",
      [userId, code]
    );
    if (!rows[0]) return res.status(400).json({ error: "Invalid or expired code" });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, userId]);
    await pool.query("DELETE FROM verification_codes WHERE user_id=$1 AND type='reset'", [userId]);
    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: "Reset failed" });
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
