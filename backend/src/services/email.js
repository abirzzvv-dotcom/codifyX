const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendVerificationEmail(email, username, code) {
  await getTransporter().sendMail({
    from: `"Hosting Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your account",
    html: `
      <h2>Welcome, ${username}!</h2>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing:4px;color:#6366f1">${code}</h1>
      <p>This code expires in 15 minutes.</p>
    `,
  });
}

async function sendPasswordResetEmail(email, code) {
  await getTransporter().sendMail({
    from: `"Hosting Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <h2>Password Reset</h2>
      <p>Your reset code is:</p>
      <h1 style="letter-spacing:4px;color:#6366f1">${code}</h1>
      <p>This code expires in 15 minutes. Ignore if you didn't request this.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
