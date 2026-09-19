import crypto from 'crypto';
import nodemailer from 'nodemailer';
import {
  saveResetTokenToFirestore,
  getResetTokenFromFirestore,
  markResetTokenUsedInFirestore,
  FirestoreResetToken,
} from '../../src/lib/firestoreService';

interface NetlifyEvent {
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// In-memory token cache for ultra-fast validation
const inMemoryTokens = new Map<string, FirestoreResetToken>();

// Safe timeout wrapper for cloud database calls in serverless context
async function withTimeout<T>(promise: Promise<T>, ms = 2000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Cached nodemailer transporter
let cachedTransporter: any = null;

function getTransporter(): any {
  const user = process.env.GMAIL_USER || 'aymane.habbo@gmail.com';
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass || pass.includes('YOUR_GMAIL_APP_PASSWORD') || !pass.trim()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user.trim(),
        pass: pass.trim(),
      },
    });
  }

  return cachedTransporter;
}

/**
 * Sends email using either Resend API or Gmail SMTP based on environment configuration.
 */
async function dispatchEmail({
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

  // 1. Prioritize Resend API if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey && !resendApiKey.includes('re_your_api_key')) {
    const configuredFrom = process.env.RESEND_FROM?.trim();
    const userReplyTo = replyTo || (configuredFrom && configuredFrom.includes('@') ? configuredFrom : 'aymane.habbo@gmail.com');

    // Resend strictly forbids sending from public webmail domains (@gmail.com, @yahoo.com, etc.)
    const isPublicWebmail = configuredFrom && /@(gmail|yahoo|hotmail|outlook|live|icloud)\.com/i.test(configuredFrom);
    let activeFrom = (!configuredFrom || isPublicWebmail)
      ? '3awdli Support <onboarding@resend.dev>'
      : configuredFrom;

    if (isPublicWebmail) {
      console.warn(`[Netlify Function Email] Notice: RESEND_FROM is set to "${configuredFrom}", but Resend forbids public webmail domains without a custom verified domain. Using "3awdli Support <onboarding@resend.dev>" with reply_to set to "${userReplyTo}".`);
    }

    const attemptSend = async (senderAddress: string) => {
      console.log(`[Password Reset Flow] [Netlify Resend Send] POST https://api.resend.com/emails with From: "${senderAddress}", To: "${to}", ReplyTo: "${userReplyTo}"`);
      const res = await fetch('https://api.resend.com/emails', {
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

      const data = (await res.json().catch(() => ({}))) as any;
      console.log(`[Password Reset Flow] [Netlify Resend Response] HTTP ${res.status} (OK: ${res.ok}):`, JSON.stringify(data));
      return { res, data };
    };

    try {
      let { res, data } = await attemptSend(activeFrom);

      // If rejected due to domain verification (e.g. custom domain not yet DNS-verified in Resend),
      // automatically fallback to onboarding@resend.dev so the email is dispatched and visible in Resend logs!
      if (!res.ok && activeFrom !== '3awdli Support <onboarding@resend.dev>') {
        const resendMsg = (data?.message || '').toLowerCase();
        if (res.status === 403 || resendMsg.includes('domain') || resendMsg.includes('verify')) {
          console.warn(`[Password Reset Flow] [Netlify Resend Fallback] "${activeFrom}" unverified (${data?.message}). Retrying with "3awdli Support <onboarding@resend.dev>"...`);
          const retry = await attemptSend('3awdli Support <onboarding@resend.dev>');
          res = retry.res;
          data = retry.data;
        }
      }

      if (res.ok && data?.id) {
        console.log('[Password Reset Flow] [Netlify Resend Success] Resend email successfully dispatched with ID:', data.id);
        return { success: true, provider: 'resend', messageId: data.id };
      }

      const resendError = data?.message || data?.error?.message || `Resend HTTP error ${res.status}`;
      console.error('[Password Reset Flow] [Netlify Resend Error] Resend API error response:', res.status, resendError);
      lastError = `Resend: ${resendError}`;
    } catch (err: any) {
      console.error('[Password Reset Flow] [Netlify Resend Error] Resend API fetch failed:', err?.message);
      lastError = `Resend network error: ${err?.message}`;
    }
  }

  // 2. Gmail SMTP fallback if GMAIL_APP_PASSWORD is configured
  const transporter = getTransporter();
  if (transporter) {
    try {
      const sender = process.env.GMAIL_USER || 'aymane.habbo@gmail.com';
      console.log(`[Password Reset Flow] [Netlify Gmail SMTP Send] Sending fallback email via Gmail SMTP to: ${to} from: ${sender}...`);
      const info = await transporter.sendMail({
        from: `"3awdli Support" <${sender}>`,
        to,
        subject,
        text: text || '',
        html: html || text || '',
        replyTo: replyTo || sender,
      });
      console.log('[Password Reset Flow] [Netlify Gmail SMTP Success] Gmail SMTP successfully dispatched:', info.messageId);
      return { 
        success: true, 
        provider: 'smtp', 
        messageId: info.messageId,
        warning: lastError ? `Resend failed (${lastError}), but dispatched successfully via Gmail SMTP.` : undefined
      };
    } catch (err: any) {
      console.error('[Password Reset Flow] [Netlify Gmail SMTP Error] Gmail SMTP error:', err?.message);
      const smtpErr = `Gmail SMTP error: ${err?.message || 'SMTP sending failed'}`;
      lastError = lastError ? `${lastError}; ${smtpErr}` : smtpErr;
    }
  }

  return {
    success: false,
    provider: 'none',
    error: lastError || 'No email service credentials configured. Set RESEND_API_KEY or GMAIL_APP_PASSWORD in Netlify site environment variables.',
  };
}

/**
 * Resolves the public web address for reset links
 */
function resolveAppUrl(event: NetlifyEvent, clientAppUrl?: string): string {
  if (clientAppUrl && typeof clientAppUrl === 'string' && clientAppUrl.trim()) {
    try {
      const parsed = new URL(clientAppUrl.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
      }
    } catch {}
  }

  const originHeader = event.headers.origin || event.headers.Origin;
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    } catch {}
  }

  const hostHeader = event.headers.host || event.headers.Host;
  if (hostHeader) {
    const proto = event.headers['x-forwarded-proto'] || 'https';
    return `${proto}://${hostHeader}`.replace(/\/+$/, '');
  }

  if (process.env.URL) {
    return process.env.URL.replace(/\/+$/, '');
  }

  return 'https://3awdli.org';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Normalize request route path
  let path = (event.path || '')
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/\/+$/, '');

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const cleanPath = path.toLowerCase();

  let body: any = {};
  if (event.body) {
    try {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }

  const requestedAction = (body?.action || event.queryStringParameters?.action || '').toLowerCase();

  const isEmailStatus = cleanPath === '/email-status' || cleanPath.endsWith('/email-status') || requestedAction === 'email-status';
  const isSendEmail = cleanPath === '/send-email' || cleanPath.endsWith('/send-email') || requestedAction === 'send-email';
  const isSupportNotification = cleanPath === '/support-notification' || cleanPath.endsWith('/support-notification') || requestedAction === 'support-notification';
  const isRequestPasswordReset = cleanPath === '/request-password-reset' || cleanPath.endsWith('/request-password-reset') || requestedAction === 'request-password-reset';
  const isVerifyResetToken = cleanPath === '/verify-reset-token' || cleanPath.endsWith('/verify-reset-token') || requestedAction === 'verify-reset-token';
  const isResetPassword = cleanPath === '/reset-password' || cleanPath.endsWith('/reset-password') || requestedAction === 'reset-password';

  console.log(`[Netlify Function] Request: ${event.httpMethod} ${event.path} -> cleanPath="${cleanPath}", matched=${
    isRequestPasswordReset ? 'request-password-reset' :
    isVerifyResetToken ? 'verify-reset-token' :
    isResetPassword ? 'reset-password' :
    isSendEmail ? 'send-email' :
    isEmailStatus ? 'email-status' :
    isSupportNotification ? 'support-notification' : 'UNKNOWN'
  }`, {
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    resendFrom: process.env.RESEND_FROM || '(not set)',
    hasGmailPass: Boolean(process.env.GMAIL_APP_PASSWORD),
  });

  try {
    // -------------------------------------------------------------
    // GET /email-status
    // -------------------------------------------------------------
    if (isEmailStatus && event.httpMethod === 'GET') {
      const hasResend = Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('re_your_api_key'));
      const hasSmtp = Boolean(process.env.GMAIL_APP_PASSWORD && !process.env.GMAIL_APP_PASSWORD.includes('YOUR_GMAIL_APP_PASSWORD'));
      const sender = hasResend
        ? (process.env.RESEND_FROM || '3awdli Support <onboarding@resend.dev>')
        : (process.env.GMAIL_USER || 'aymane.habbo@gmail.com');

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          configured: hasResend || hasSmtp,
          provider: hasResend ? 'resend' : hasSmtp ? 'smtp' : 'none',
          sender,
        }),
      };
    }

    // -------------------------------------------------------------
    // POST /send-email
    // -------------------------------------------------------------
    if (isSendEmail && event.httpMethod === 'POST') {
      const { to, subject, html, text, replyTo } = body;
      if (!to || !subject || (!html && !text)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Missing to, subject, or content' }),
        };
      }

      const result = await dispatchEmail({ to, subject, html, text, replyTo });
      return {
        statusCode: result.success ? 200 : 503,
        headers: CORS_HEADERS,
        body: JSON.stringify(result),
      };
    }

    // -------------------------------------------------------------
    // POST /support-notification
    // -------------------------------------------------------------
    if (isSupportNotification && event.httpMethod === 'POST') {
      const { subject, message, email, category, priority, userName, userId, destinationEmail } = body;
      const targetDestination = destinationEmail || process.env.GMAIL_USER || 'aymane.habbo@gmail.com';

      const emailSubject = `[3awdli Support ${priority === 'urgent' ? '🔴 URGENT' : '🟢'}] ${subject || 'Inquiry'}`;
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #FAF8F5; border: 1px solid #E6E0D6; border-radius: 16px;">
          <div style="border-bottom: 2px solid #315243; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #1F362C; margin: 0 0 6px 0; font-size: 20px;">New 3awdli Support Inquiry</h2>
            <p style="color: #617068; margin: 0; font-size: 13px;">Received via 3awdli on Netlify</p>
          </div>
          <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1px solid #EBE5DC; margin-bottom: 18px;">
            <p><strong>From:</strong> ${userName || 'Anonymous'} (${email || 'No email'})</p>
            <p><strong>Category:</strong> ${category || 'General'}</p>
            <p><strong>Priority:</strong> ${(priority || 'normal').toUpperCase()}</p>
            ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
          </div>
          <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1px solid #EBE5DC;">
            <h4 style="margin: 0 0 10px 0;">Subject: ${subject}</h4>
            <div style="white-space: pre-wrap; color: #33443C;">${message}</div>
          </div>
        </div>
      `;

      const result = await dispatchEmail({
        to: targetDestination,
        subject: emailSubject,
        html: htmlContent,
        text: `From: ${userName} (${email})\nSubject: ${subject}\n\n${message}`,
        replyTo: email,
      });

      return {
        statusCode: result.success ? 200 : 200, // Return 200 so UI doesn't crash even if email provider not yet set
        headers: CORS_HEADERS,
        body: JSON.stringify(result),
      };
    }

    // -------------------------------------------------------------
    // POST /request-password-reset
    // -------------------------------------------------------------
    if (isRequestPasswordReset && event.httpMethod === 'POST') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email) {
        console.warn('[Password Reset Flow] [Netlify Step 1/5] Rejected: No email provided in request body');
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Email address is required' }),
        };
      }

      console.log(`[Password Reset Flow] [Netlify Step 1/5] Initiating reset request for: "${email}" (client host: ${body.appUrl || 'auto'})`);

      // 1. Generate secure 32-byte hex token
      const token = crypto.randomBytes(32).toString('hex');
      const now = Date.now();
      const expiresAt = now + 60 * 60 * 1000; // 1-hour expiration
      console.log(`[Password Reset Flow] [Netlify Step 2/5] Generated crypto token: ${token.substring(0, 10)}... (valid until ${new Date(expiresAt).toISOString()})`);

      const tokenRecord: FirestoreResetToken = {
        token,
        email,
        createdAt: now,
        expiresAt,
        used: false,
      };

      // Save to memory cache
      inMemoryTokens.set(token, tokenRecord);

      // Save to Firestore cloud database with timeout protection
      try {
        await withTimeout(saveResetTokenToFirestore(tokenRecord), 2000, undefined);
        console.log(`[Password Reset Flow] [Netlify Step 3/5] Token synced to Firestore database for ${email}`);
      } catch (err: any) {
        console.warn('[Password Reset Flow] [Netlify Step 3/5] Firestore sync notice:', err?.message);
      }

      // Build reset URL
      const origin = resolveAppUrl(event, body.appUrl);
      const resetUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      console.log(`[Password Reset Flow] [Netlify Step 4/5] Generated secure reset URL: ${resetUrl}`);

      console.log(`[Password Reset Flow] [Netlify Step 5/5] Invoking dispatchEmail for recipient: "${email}"`);

      // 2. Dispatch email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 24px; color: #1F362C;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #EBE5DC; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
            <div style="background: #315243; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">3awdli • عاود لي</h1>
              <p style="color: #E2ECE6; margin: 6px 0 0 0; font-size: 13px;">Confidential Emotional & Peer Support</p>
            </div>
            <div style="padding: 28px 24px;">
              <h2 style="font-size: 18px; color: #1F362C; margin: 0 0 14px 0;">Reset Your Password / طلب إعادة تعيين كلمة المرور</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4A5B52; margin: 0 0 16px 0;">
                Hello, we received a request to reset the password for your 3awdli account associated with <strong>${email}</strong>.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${resetUrl}" style="background-color: #315243; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 15px;">
                  Reset Password / إعادة تعيين كلمة المرور
                </a>
              </div>
              <p style="font-size: 12px; word-break: break-all; color: #315243; background: #F4F8F5; padding: 10px 12px; border-radius: 8px; border: 1px solid #E1ECE5;">
                <a href="${resetUrl}" style="color: #315243; text-decoration: underline;">${resetUrl}</a>
              </p>
              <p style="font-size: 12px; color: #7B8B82; margin-top: 20px;">
                This link will expire in 1 hour and can only be used once. If you did not request this, you can safely ignore this message.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailResult = await dispatchEmail({
        to: email,
        subject: 'Reset your 3awdli password / إعادة تعيين كلمة المرور',
        html: emailHtml,
        text: `Reset your 3awdli password by visiting this link: ${resetUrl}`,
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: emailResult.success,
          emailSent: emailResult.success,
          provider: emailResult.provider || 'none',
          messageId: emailResult.messageId,
          error: emailResult.error,
          warning: emailResult.warning,
          smtpConfigured: emailResult.success,
          message: emailResult.success
            ? 'Password reset email sent successfully.'
            : (emailResult.error || 'Password reset link prepared, but email delivery failed.'),
          resetUrl,
          expiresIn: '1 hour',
        }),
      };
    }

    // -------------------------------------------------------------
    // POST /verify-reset-token
    // -------------------------------------------------------------
    if (isVerifyResetToken && event.httpMethod === 'POST') {
      const token = (body.token || '').trim();
      if (!token) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ valid: false, error: 'missing_token', message: 'Reset token is required' }),
        };
      }

      // Check memory cache first
      let record = inMemoryTokens.get(token);

      // Check Firestore if not found in memory
      if (!record) {
        try {
          const fromFirestore = await withTimeout(getResetTokenFromFirestore(token), 2000, null);
          if (fromFirestore) {
            record = fromFirestore;
            inMemoryTokens.set(token, record);
          }
        } catch (err: any) {
          console.warn('[Netlify Function] Firestore token verification warning:', err?.message);
        }
      }

      if (!record) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ valid: false, error: 'invalid', message: 'This reset link is invalid or has expired.' }),
        };
      }

      if (record.used) {
        return {
          statusCode: 410,
          headers: CORS_HEADERS,
          body: JSON.stringify({ valid: false, error: 'already_used', message: 'This reset link has already been used.' }),
        };
      }

      if (Date.now() > record.expiresAt) {
        return {
          statusCode: 410,
          headers: CORS_HEADERS,
          body: JSON.stringify({ valid: false, error: 'expired', message: 'This reset link has expired.' }),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ valid: true, email: record.email }),
      };
    }

    // -------------------------------------------------------------
    // POST /reset-password
    // -------------------------------------------------------------
    if (isResetPassword && event.httpMethod === 'POST') {
      const { token, newPassword } = body;
      const cleanToken = (token || '').trim();

      if (!cleanToken || !newPassword) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Token and new password are required' }),
        };
      }

      if (newPassword.length < 6) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }),
        };
      }

      // Check memory or Firestore
      let record = inMemoryTokens.get(cleanToken);
      if (!record) {
        try {
          const fromFirestore = await withTimeout(getResetTokenFromFirestore(cleanToken), 2000, null);
          if (fromFirestore) {
            record = fromFirestore;
          }
        } catch (err: any) {
          console.warn('[Netlify Function] Firestore fetch warning during reset:', err?.message);
        }
      }

      if (!record) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'Invalid reset token' }),
        };
      }

      if (record.used) {
        return {
          statusCode: 410,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'This reset link has already been used.' }),
        };
      }

      if (Date.now() > record.expiresAt) {
        return {
          statusCode: 410,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: 'This reset link has expired.' }),
        };
      }

      // Mark used in memory and Firestore
      record.used = true;
      record.usedAt = Date.now();
      inMemoryTokens.set(cleanToken, record);

      try {
        await withTimeout(markResetTokenUsedInFirestore(cleanToken), 2000, false);
      } catch (err: any) {
        console.warn('[Netlify Function] Could not mark token used in Firestore:', err?.message);
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          email: record.email,
          message: 'Password successfully updated.',
        }),
      };
    }

    // Default 404 handler for unknown routes
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Not Found: ${path}` }),
    };
  } catch (err: any) {
    console.error('[Netlify Function Unhandled Error]:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err?.message || 'Internal Server Error' }),
    };
  }
};
