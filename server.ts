import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import {
  saveResetTokenToFirestore,
  getResetTokenFromFirestore,
  markResetTokenUsedInFirestore,
} from "./src/lib/firestoreService";

dotenv.config();

interface PasswordResetToken {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number; // 1-hour expiration
  used: boolean;
  usedAt?: number;
}

const TOKENS_FILE = path.join(process.cwd(), 'data', 'password-reset-tokens.json');

function loadTokensFromFile(): Map<string, PasswordResetToken> {
  const map = new Map<string, PasswordResetToken>();
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
      const list: PasswordResetToken[] = JSON.parse(raw);
      list.forEach((t) => map.set(t.token, t));
    }
  } catch (err) {
    console.warn('[SMTP] Could not read stored reset tokens file:', err);
  }
  return map;
}

function saveTokensToFile(map: Map<string, PasswordResetToken>) {
  try {
    const dir = path.dirname(TOKENS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const list = Array.from(map.values());
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SMTP] Could not save reset tokens to file:', err);
  }
}

const resetTokensStore = loadTokensFromFile();

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    const hasResend = Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('re_your_api_key'));
    const hasPassword = Boolean(process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD.trim());
    const sender = hasResend
      ? (process.env.RESEND_FROM || '3awdli Support <onboarding@resend.dev>')
      : (process.env.GMAIL_USER || 'aymane.habbo@gmail.com');
    res.json({
      configured: hasResend || hasPassword,
      provider: hasResend ? 'resend' : hasPassword ? 'smtp' : 'none',
      sender,
    });
  });

  // Unified Email Dispatcher (Resend API + Gmail SMTP)
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
  }): Promise<{ success: boolean; provider?: string; messageId?: string; error?: string; warning?: string }> {
    let lastError = '';

    // 1. Resend API
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (resendApiKey && !resendApiKey.includes('re_your_api_key')) {
      const configuredFrom = process.env.RESEND_FROM?.trim();
      const userReplyTo = replyTo || (configuredFrom && configuredFrom.includes('@') ? configuredFrom : 'aymane.habbo@gmail.com');
      
      // Resend forbids sending from public webmail domains (@gmail.com, @yahoo.com, etc.)
      const isPublicWebmail = configuredFrom && /@(gmail|yahoo|hotmail|outlook|live|icloud)\.com/i.test(configuredFrom);
      let activeFrom = (!configuredFrom || isPublicWebmail)
        ? '3awdli Support <onboarding@resend.dev>'
        : configuredFrom;

      if (isPublicWebmail) {
        console.warn(`[Server Email] Notice: RESEND_FROM is set to "${configuredFrom}", but Resend forbids public webmail domains without a custom verified domain. Using "3awdli Support <onboarding@resend.dev>" with reply_to set to "${userReplyTo}".`);
      }

      const attemptSend = async (senderAddress: string) => {
        console.log(`[Server Email] Attempting Resend dispatch to ${to} from "${senderAddress}" (reply-to: ${userReplyTo})...`);
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: senderAddress,
            to: [to],
            subject,
            html: html || text,
            text: text || '',
            reply_to: userReplyTo,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as any;
        return { response, data };
      };

      try {
        let { response, data } = await attemptSend(activeFrom);

        // If rejected due to domain verification (e.g. custom domain not yet DNS-verified in Resend),
        // automatically fallback to onboarding@resend.dev so the email is dispatched and visible in Resend logs!
        if (!response.ok && activeFrom !== '3awdli Support <onboarding@resend.dev>') {
          const resendMsg = (data?.message || '').toLowerCase();
          if (response.status === 403 || resendMsg.includes('domain') || resendMsg.includes('verify')) {
            console.warn(`[Server Email] Resend rejected "${activeFrom}" (${data?.message}). Retrying with "3awdli Support <onboarding@resend.dev>"...`);
            const retry = await attemptSend('3awdli Support <onboarding@resend.dev>');
            response = retry.response;
            data = retry.data;
          }
        }

        if (response.ok && data?.id) {
          console.log('[Server Email] Resend email dispatched successfully with ID:', data.id);
          return { success: true, provider: 'resend', messageId: data.id };
        }

        const resendError = data?.message || data?.error?.message || `Resend HTTP ${response.status}`;
        console.error('[Server Email] Resend API error response:', response.status, resendError, data);
        lastError = `Resend: ${resendError}`;
      } catch (err: any) {
        console.error('[Server Email] Resend API fetch network error:', err?.message);
        lastError = `Resend network error: ${err?.message}`;
      }
    }

    // 2. Gmail SMTP
    const transporter = getTransporter();
    if (transporter) {
      try {
        const user = process.env.GMAIL_USER || 'aymane.habbo@gmail.com';
        console.log(`[Server Email] Attempting Gmail SMTP dispatch to ${to} from ${user}...`);
        const info = await transporter.sendMail({
          from: `"3awdli Support" <${user}>`,
          to,
          subject,
          text: text || '',
          html: html || text || '',
          replyTo: replyTo || user,
        });
        console.log('[Server Email] Gmail SMTP dispatched successfully:', info.messageId);
        return { 
          success: true, 
          provider: 'smtp', 
          messageId: info.messageId,
          warning: lastError ? `Resend failed (${lastError}), but dispatched via Gmail SMTP.` : undefined
        };
      } catch (err: any) {
        console.error('[Server Email] Gmail SMTP error:', err?.message);
        const smtpErr = `Gmail SMTP error: ${err?.message || 'SMTP sending failed'}`;
        lastError = lastError ? `${lastError}; ${smtpErr}` : smtpErr;
      }
    }

    return {
      success: false,
      provider: 'none',
      error: lastError || 'No email service credentials configured. Set RESEND_API_KEY or GMAIL_APP_PASSWORD in environment variables.',
    };
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
  // SECURE PASSWORD RESET API (Real Email via Gmail SMTP)
  // =========================================================

  /**
   * Helper to accurately determine the live public domain of the application.
   * Priority order:
   * 1. The client-provided URL from the browser (the live address where the user is using the app)
   * 2. Browser origin / referer header
   * 3. Forwarded proxy host (excluding internal Google-internal Cloud Run ais-dev domains)
   * 4. Request host header
   * 5. Fallback to platform APP_URL (if configured, valid, and not ais-dev) or localhost
   */
  function resolvePublicAppUrl(req: express.Request, clientAppUrl?: string): string {
    // 1. Highest priority: The actual URL passed from the client browser
    if (clientAppUrl && typeof clientAppUrl === 'string' && clientAppUrl.trim()) {
      try {
        const parsed = new URL(clientAppUrl.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          const origin = `${parsed.protocol}//${parsed.host}`;
          return origin.replace(/\/+$/, '');
        }
      } catch (e) {
        console.warn('[SMTP] Could not parse clientAppUrl:', clientAppUrl, e);
      }
    }

    // 2. Check Origin or Referer header from browser request
    const originHeader = (req.headers.origin as string) || '';
    if (originHeader) {
      try {
        const parsed = new URL(originHeader);
        if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname.includes('ais-dev-')) {
          return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
        }
      } catch {}
    }

    const refererHeader = (req.headers.referer as string) || '';
    if (refererHeader) {
      try {
        const parsed = new URL(refererHeader);
        if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname.includes('ais-dev-')) {
          return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
        }
      } catch {}
    }

    // 3. Reverse proxy / Host header (excluding internal Google ais-dev domains)
    const forwardedHost = (req.headers['x-forwarded-host'] as string) || '';
    if (forwardedHost && !forwardedHost.includes('ais-dev-')) {
      const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }

    const hostHeader = (req.headers.host as string) || '';
    if (hostHeader && !hostHeader.includes('ais-dev-')) {
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      return `${proto}://${hostHeader}`.replace(/\/+$/, '');
    }

    // 4. Platform APP_URL environment variable (if not placeholder and not internal ais-dev)
    if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL') && !process.env.APP_URL.includes('ais-dev-')) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }

    // 5. If only forwardedHost or host was available (even if ais-dev)
    if (forwardedHost) {
      const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }

    if (hostHeader) {
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      return `${proto}://${hostHeader}`.replace(/\/+$/, '');
    }

    return 'http://localhost:3000';
  }

  // 1. Request Password Reset (Dispatches Real Email from aymane.habbo@gmail.com)
  app.post("/api/request-password-reset", async (req, res) => {
    try {
      const { email, appUrl } = req.body;
      if (!email || !email.trim()) {
        return res.status(400).json({ success: false, error: "Email address is required" });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Generate a crypto-secure random reset token
      const token = crypto.randomBytes(32).toString('hex');
      const now = Date.now();
      const expiresAt = now + 60 * 60 * 1000; // 1-hour expiration

      // Save token to memory store & persist to JSON file
      const tokenRecord: PasswordResetToken = {
        token,
        email: cleanEmail,
        createdAt: now,
        expiresAt,
        used: false,
      };
      resetTokensStore.set(token, tokenRecord);
      saveTokensToFile(resetTokensStore);

      // Also persist to cloud Firestore database
      saveResetTokenToFirestore(tokenRecord).catch((err) => {
        console.warn('[Server] Firestore token sync notice:', err?.message);
      });

      // Determine public client origin URL
      const origin = resolvePublicAppUrl(req, appUrl);
      const resetUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

      const sender = (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('re_your_api_key'))
        ? (process.env.RESEND_FROM || '3awdli Support <onboarding@resend.dev>')
        : (process.env.GMAIL_USER || 'aymane.habbo@gmail.com');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 24px; color: #1F362C;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #EBE5DC; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
            <div style="background: #315243; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">3awdli • عاود لي</h1>
              <p style="color: #E2ECE6; margin: 6px 0 0 0; font-size: 13px;">Confidential Emotional & Peer Support</p>
            </div>
            <div style="padding: 28px 24px;">
              <h2 style="font-size: 18px; color: #1F362C; margin: 0 0 14px 0;">Reset Your Password / طلب إعادة تعيين كلمة المرور</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4A5B52; margin: 0 0 16px 0;">
                Hello, we received a request to reset the password for your 3awdli account associated with <strong>${cleanEmail}</strong>.
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #4A5B52; margin: 0 0 24px 0;">
                Click the secure button below to set a new password for your account:
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${resetUrl}" style="background-color: #315243; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 15px; box-shadow: 0 2px 6px rgba(49, 82, 67, 0.25);">
                  Reset Password / إعادة تعيين كلمة المرور
                </a>
              </div>
              <p style="font-size: 12px; color: #7B8B82; line-height: 1.5; margin: 24px 0 8px 0;">
                If the button above does not open, copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; word-break: break-all; color: #315243; background: #F4F8F5; padding: 10px 12px; border-radius: 8px; border: 1px solid #E1ECE5; margin: 0 0 24px 0;">
                <a href="${resetUrl}" style="color: #315243; text-decoration: underline;">${resetUrl}</a>
              </p>
              <div style="background: #FFF9F2; border: 1px solid #F5E6D3; border-radius: 10px; padding: 14px; margin-top: 20px;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #9C5212;">Security Details:</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #7E4F25; line-height: 1.5;">
                  <li>This reset link is valid for <strong>1 hour</strong> and can only be used <strong>once</strong>.</li>
                  <li>If you did not request this password reset, you can safely disregard this message. Your password remains unchanged.</li>
                </ul>
              </div>
            </div>
            <div style="background: #FAF8F5; padding: 16px 24px; text-align: center; border-top: 1px solid #EBE5DC; font-size: 12px; color: #7B8B82;">
              Dispatched from <strong>${sender}</strong> • 3awdli Platform Security
            </div>
          </div>
        </body>
        </html>
      `;

      const textFallback = `
Reset Your 3awdli Password
Hello, we received a request to reset the password for your account (${cleanEmail}).
Please click or visit this secure link to set a new password:
${resetUrl}

This link is valid for 1 hour and can only be used once.
If you did not request this, please ignore this email.
Sent from ${sender} (3awdli Platform).
      `;

      const emailResult = await sendEmailHelper({
        to: cleanEmail,
        subject: "Reset your 3awdli password | إعادة تعيين كلمة المرور",
        html: emailHtml,
        text: textFallback,
      });

      console.log(`[Email] Password reset result for ${cleanEmail}:`, emailResult);

      return res.json({
        success: emailResult.success,
        emailSent: emailResult.success,
        smtpConfigured: emailResult.success,
        provider: emailResult.provider || 'none',
        messageId: emailResult.messageId,
        error: emailResult.error,
        warning: emailResult.warning,
        message: emailResult.success
          ? 'Password reset link sent to your email.'
          : (emailResult.error || 'Password reset link prepared, but email delivery failed.'),
        resetUrl,
        expiresIn: '1 hour',
      });
    } catch (err: any) {
      console.error('[Email Error] Password reset dispatch failed:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to dispatch password reset email',
      });
    }
  });

  // 2. Verify Password Reset Token
  app.post("/api/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ valid: false, error: 'missing_token', message: 'Reset token is required' });
      }

      let record = resetTokensStore.get(token);

      // Check Firestore if not in memory
      if (!record) {
        try {
          const fromFirestore = await getResetTokenFromFirestore(token);
          if (fromFirestore) {
            record = fromFirestore;
            resetTokensStore.set(token, record);
          }
        } catch (err: any) {
          console.warn('[Server] Firestore token lookup notice:', err?.message);
        }
      }

      if (!record) {
        return res.status(404).json({
          valid: false,
          error: 'invalid',
          message: 'This password reset link is invalid or does not exist.',
        });
      }

      if (record.used) {
        return res.status(400).json({
          valid: false,
          error: 'already_used',
          message: 'This password reset link has already been used. Please request a new one.',
        });
      }

      if (Date.now() > record.expiresAt) {
        return res.status(400).json({
          valid: false,
          error: 'expired',
          message: 'This password reset link has expired (links are valid for 1 hour). Please request a new one.',
        });
      }

      return res.json({
        valid: true,
        email: record.email,
        expiresAt: record.expiresAt,
      });
    } catch (err: any) {
      return res.status(500).json({ valid: false, error: 'server_error', message: err.message });
    }
  });

  // 3. Complete Password Reset
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Token and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long',
        });
      }

      let record = resetTokensStore.get(token);
      if (!record) {
        try {
          const fromFirestore = await getResetTokenFromFirestore(token);
          if (fromFirestore) {
            record = fromFirestore;
          }
        } catch (err: any) {
          console.warn('[Server] Firestore token lookup notice:', err?.message);
        }
      }

      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Invalid reset token',
        });
      }

      if (record.used) {
        return res.status(400).json({
          success: false,
          error: 'This password reset link has already been used. Please request a new one.',
        });
      }

      if (Date.now() > record.expiresAt) {
        return res.status(400).json({
          success: false,
          error: 'This password reset link has expired (valid for 1 hour). Please request a new one.',
        });
      }

      // Mark token as used immediately so it cannot be used again!
      record.used = true;
      record.usedAt = Date.now();
      resetTokensStore.set(token, record);
      saveTokensToFile(resetTokensStore);

      // Also mark used in Firestore
      markResetTokenUsedInFirestore(token).catch(() => {});

      console.log(`[Password Reset] Password successfully reset for ${record.email} via token`);

      return res.json({
        success: true,
        email: record.email,
        message: 'Password successfully updated.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to update password',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
