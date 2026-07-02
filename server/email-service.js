const nodemailer = require('nodemailer');

let transporter = null;

function isEmailConfigured() {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
    if (transporter) return transporter;
    if (!isEmailConfigured()) return null;

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    return transporter;
}

async function sendOtpEmail(toEmail, otp, adminName) {
    const from = process.env.SMTP_FROM || `LiveHospital <${process.env.SMTP_USER}>`;
    const subject = 'LiveHospital - Password Reset OTP';
    const greeting = adminName ? `Hello ${adminName},` : 'Hello,';
    const text = `${greeting}\n\nYour OTP for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\n— LiveHospital Team`;
    const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#1e88e5;margin:0 0 12px;">LiveHospital</h2>
            <p style="color:#334155;line-height:1.6;">${greeting}</p>
            <p style="color:#334155;line-height:1.6;">Your OTP for password reset is:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0f172a;background:#f1f5f9;padding:16px 24px;border-radius:8px;text-align:center;">${otp}</p>
            <p style="color:#64748b;font-size:14px;">Valid for <strong>10 minutes</strong>. Do not share this code.</p>
            <p style="color:#94a3b8;font-size:13px;margin-top:24px;">If you did not request a password reset, ignore this email.</p>
        </div>
    `;

    const mailer = getTransporter();
    if (!mailer) {
        console.log(`[DEV] OTP for ${toEmail}: ${otp}`);
        return { sent: false, devMode: true };
    }

    await mailer.sendMail({ from, to: toEmail, subject, text, html });
    return { sent: true, devMode: false };
}

module.exports = { sendOtpEmail, isEmailConfigured };
