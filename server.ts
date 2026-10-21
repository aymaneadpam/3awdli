import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // Lazy Nodemailer Transporter
  function getTransporter() {
    const user = process.env.GMAIL_USER || 'aymane.habbo@gmail.com';
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!pass || !pass.trim()) {
      return null;
    }
    // Clean up spaces in app passwords (users often copy "abcd efgh ijkl mnop")
    const cleanPassword = pass.trim().replace(/\s+/g, '');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user.trim(),
        pass: cleanPassword,
      },
    });
  }

  // Check email configuration status
  app.get("/api/email-status", (req, res) => {
    const hasPassword = Boolean(process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD.trim() && !process.env.GMAIL_APP_PASSWORD.includes('YOUR_GMAIL_APP_PASSWORD'));
    const sender = (process.env.GMAIL_USER || 'aymane.habbo@gmail.com').trim();
    res.json({
      configured: hasPassword,
      provider: hasPassword ? 'smtp' : 'none',
      sender,
    });
  });

  // Dedicated Gmail SMTP Email Dispatcher
  async function sendEmailHelper({
    to,
    subject,
    html,
    text,
    replyTo,
  }: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }): Promise<{ success: boolean; provider?: string; messageId?: string; error?: string }> {
    const transporter = getTransporter();
    if (!transporter) {
      console.error('[Server Email] Gmail SMTP not configured: GMAIL_APP_PASSWORD is missing or empty.');
      return {
        success: false,
        provider: 'none',
        error: 'Gmail credentials not configured. Please set GMAIL_APP_PASSWORD in your environment variables.',
      };
    }

    const senderEmail = (process.env.GMAIL_USER || 'aymane.habbo@gmail.com').trim();
    console.log(`[Password Reset Flow] [Gmail SMTP Send] Sending email via Gmail SMTP to: "${to}" from: "${senderEmail}"...`);

    try {
      const info = await transporter.sendMail({
        from: `"3awdli Support" <${senderEmail}>`,
        to,
        subject,
        text: text || '',
        html: html || text || '',
        replyTo: replyTo || senderEmail,
      });

      console.log('[Password Reset Flow] [Gmail SMTP Success] Message sent successfully with ID:', info.messageId);
      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error('[Password Reset Flow] [Gmail SMTP Error] SMTP failed:', err?.message);
      const isAuthError = err?.message && (err.message.includes('Username and Password not accepted') || err.message.includes('Invalid login') || err.code === 'EAUTH');
      const errorMessage = isAuthError
        ? 'Gmail authentication failed. Please verify that your 16-character GMAIL_APP_PASSWORD is correctly configured without spaces.'
        : `Gmail SMTP error: ${err?.message || 'Failed to send email via Gmail'}`;

      return {
        success: false,
        provider: 'smtp',
        error: errorMessage,
      };
    }
  }

  // Generic send email endpoint
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text, replyTo } = req.body;
      if (!to || !subject || (!html && !text)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters (to, subject, and content).',
        });
      }

      const result = await sendEmailHelper({ to, subject, html, text, replyTo });
      if (!result.success) {
        return res.status(503).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      console.error('[Email Error] Failed to send email:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to send email',
      });
    }
  });

  // Support Request Notification endpoint
  app.post("/api/support-notification", async (req, res) => {
    try {
      const { subject, message, email, category, priority, userName, userId, destinationEmail } = req.body;
      const targetDestination = destinationEmail || process.env.GMAIL_USER || 'aymane.habbo@gmail.com';

      const emailSubject = `[3awdli Support ${priority === 'urgent' ? '🔴 URGENT' : '🟢'}] ${subject}`;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #FAF8F5; border: 1px solid #E6E0D6; border-radius: 16px;">
          <div style="border-bottom: 2px solid #315243; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #1F362C; margin: 0 0 6px 0; font-size: 20px;">New 3awdli Support Inquiry</h2>
            <p style="color: #617068; margin: 0; font-size: 13px;">Received through the 3awdli platform</p>
          </div>

          <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1px solid #EBE5DC; margin-bottom: 18px;">
            <table style="width: 100%; font-size: 13px; color: #2D3E35; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-weight: 600; width: 120px;">Sender:</td>
                <td style="padding: 6px 0;">${userName || 'Anonymous Visitor'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">Reply-To Email:</td>
                <td style="padding: 6px 0;"><a href="mailto:${email}" style="color: #315243; font-weight: 600;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">Category:</td>
                <td style="padding: 6px 0;">${category || 'General'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">Priority:</td>
                <td style="padding: 6px 0;">
                  <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; ${priority === 'urgent' ? 'background: #FFEBEB; color: #C53030;' : 'background: #EBF7EE; color: #237844;'}">
                    ${(priority || 'normal').toUpperCase()}
                  </span>
                </td>
              </tr>
              ${userId ? `<tr><td style="padding: 6px 0; font-weight: 600;">User ID:</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${userId}</td></tr>` : ''}
            </table>
          </div>

          <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1px solid #EBE5DC; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1F362C;">Subject: ${subject}</h4>
            <div style="font-size: 14px; line-height: 1.6; color: #33443C; white-space: pre-wrap;">${message}</div>
          </div>

          <div style="text-align: center; padding-top: 8px; font-size: 12px; color: #7B8B82;">
            <p style="margin: 0 0 8px 0;">You can reply directly to this email to contact <strong>${email}</strong>.</p>
            <p style="margin: 0; font-style: italic;">3awdli Support Notification Engine</p>
          </div>
        </div>
      `;

      const result = await sendEmailHelper({
        to: targetDestination,
        replyTo: email,
        subject: emailSubject,
        text: `New 3awdli Support Request from ${userName || 'Visitor'} (${email})\nSubject: ${subject}\nCategory: ${category}\nPriority: ${priority}\n\nMessage:\n${message}`,
        html: htmlContent,
      });

      console.log(`[Support Notification] Forward result to ${targetDestination}:`, result);
      return res.json(result);
    } catch (err: any) {
      console.error('[Notification Error] Failed to forward support request:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to forward support request',
      });
    }
  });

  // =========================================================
  // PASSWORD RESET API (Firebase Auth Built-in Flow)
  // =========================================================

  // 1. Request Password Reset (Neutral response for security)
  app.post("/api/request-password-reset", async (_req, res) => {
    return res.json({
      success: true,
      emailSent: true,
      message: 'If an account exists for this email, a reset link has been sent.',
    });
  });

  // 2. Verify Password Reset Token (Deprecated - managed by Firebase Auth)
  app.post("/api/verify-reset-token", async (_req, res) => {
    return res.status(400).json({
      valid: false,
      error: 'invalid',
      message: 'Password reset is managed securely by the Firebase email link.',
    });
  });

  // 3. Complete Password Reset (Deprecated - managed by Firebase Auth)
  app.post("/api/reset-password", async (_req, res) => {
    return res.status(400).json({
      success: false,
      error: 'Please use the password reset link sent to your email by Firebase.',
    });
  });

  // Serve static assets from public folder
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR !== 'false';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
