import crypto from 'crypto';
import nodemailer from 'nodemailer';
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
 * Sends email using Gmail SMTP based on environment configuration.
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
}): Promise<{ success: boolean; provider?: string; messageId?: string; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error('[Netlify Function Email] Gmail SMTP not configured: GMAIL_APP_PASSWORD is missing in Netlify environment.');
    return {
      success: false,
      provider: 'none',
      error: 'Gmail credentials not configured. Please set GMAIL_APP_PASSWORD in your Netlify site environment variables.',
    };
  }

  const sender = (process.env.GMAIL_USER || 'aymane.habbo@gmail.com').trim();
  console.log(`[Password Reset Flow] [Netlify Gmail SMTP Send] Sending email via Gmail SMTP to: "${to}" from: "${sender}"...`);

  try {
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
    };
  } catch (err: any) {
    console.error('[Password Reset Flow] [Netlify Gmail SMTP Error] Gmail SMTP error:', err?.message);
    const isAuthError = err?.message && (err.message.includes('Username and Password not accepted') || err.message.includes('Invalid login') || err.code === 'EAUTH');
    const errorMessage = isAuthError
      ? 'Gmail authentication failed. Please verify that your 16-character GMAIL_APP_PASSWORD is correctly configured without spaces in Netlify.'
      : `Gmail SMTP error: ${err?.message || 'Failed to send email via Gmail'}`;

    return {
      success: false,
      provider: 'smtp',
      error: errorMessage,
    };
  }
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
    hasGmailPass: Boolean(process.env.GMAIL_APP_PASSWORD),
    gmailUser: process.env.GMAIL_USER || 'aymane.habbo@gmail.com',
  });

  try {
    // -------------------------------------------------------------
    // GET /email-status
    // -------------------------------------------------------------
    if (isEmailStatus && event.httpMethod === 'GET') {
      const hasSmtp = Boolean(process.env.GMAIL_APP_PASSWORD && !process.env.GMAIL_APP_PASSWORD.includes('YOUR_GMAIL_APP_PASSWORD'));
      const sender = (process.env.GMAIL_USER || 'aymane.habbo@gmail.com').trim();

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          configured: hasSmtp,
          provider: hasSmtp ? 'smtp' : 'none',
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
    // POST /request-password-reset (Neutral response for security)
    // -------------------------------------------------------------
    if (isRequestPasswordReset && event.httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          emailSent: true,
          message: 'If an account exists for this email, a reset link has been sent.',
        }),
      };
    }

    // -------------------------------------------------------------
    // POST /verify-reset-token (Deprecated - managed by Firebase Auth)
    // -------------------------------------------------------------
    if (isVerifyResetToken && event.httpMethod === 'POST') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          valid: false,
          error: 'invalid',
          message: 'Password reset is managed securely by the Firebase email link.',
        }),
      };
    }

    // -------------------------------------------------------------
    // POST /reset-password (Deprecated - managed by Firebase Auth)
    // -------------------------------------------------------------
    if (isResetPassword && event.httpMethod === 'POST') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: 'Please use the password reset link sent to your email by Firebase.',
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
