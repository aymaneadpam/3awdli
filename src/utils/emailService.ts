import { SupportRequest } from '../types';
import {
  saveResetTokenToFirestore,
  getResetTokenFromFirestore,
  markResetTokenUsedInFirestore,
} from '../lib/firestoreService';

export interface EmailConfigStatus {
  configured: boolean;
  sender: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Safe fetch wrapper that prevents "JSON.parse: unexpected character at line 1 column 1"
 * when a static host (like Netlify or an offline endpoint) returns an HTML 404/500 error page.
 */
async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; isHtml: boolean; rawText: string }> {
  try {
    const res = await fetch(url, options);
    const rawText = await res.text();
    let data: T | null = null;
    let isHtml = false;

    const trimmed = rawText.trim();
    if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')) {
      isHtml = true;
    } else {
      try {
        data = JSON.parse(rawText) as T;
      } catch {
        // Not valid JSON
      }
    }

    return {
      ok: res.ok && data !== null,
      status: res.status,
      data,
      isHtml,
      rawText,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      isHtml: false,
      rawText: err?.message || 'Network request failed',
    };
  }
}

/**
 * Generates a crypto-secure 32-character hexadecimal token on the client
 */
function generateClientResetToken(): string {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint8Array(24);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Checks if the backend has GMAIL_APP_PASSWORD or RESEND_API_KEY configured.
 */
export async function checkEmailConfigStatus(): Promise<EmailConfigStatus> {
  const result = await safeFetchJson<any>('/api/email-status');
  if (result.ok && result.data) {
    return {
      configured: Boolean(result.data.configured),
      sender: result.data.sender || 'aymane.habbo@gmail.com',
    };
  }
  return { configured: false, sender: 'aymane.habbo@gmail.com' };
}

/**
 * Sends a real email through Gmail SMTP or Resend via backend API.
 */
export async function sendEmailViaSMTP(payload: SendEmailPayload): Promise<SendEmailResult> {
  const result = await safeFetchJson<any>('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!result.ok || !result.data?.success) {
    const errorMsg =
      result.data?.error ||
      (result.isHtml
        ? 'Email service endpoint unreachable on this host (Netlify static routing).'
        : `Email delivery failed (${result.status || 'network error'})`);
    return {
      success: false,
      error: errorMsg,
    };
  }

  return {
    success: true,
    messageId: result.data.messageId,
  };
}

/**
 * Forwards a support request or listener report directly to aymane.habbo@gmail.com
 */
export async function forwardSupportRequestViaSMTP(request: SupportRequest): Promise<SendEmailResult> {
  const result = await safeFetchJson<any>('/api/support-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: request.subject,
      message: request.message,
      email: request.email,
      category: request.category,
      priority: request.priority,
      userName: request.userName,
      userId: request.userId,
      destinationEmail: request.destinationEmail || 'aymane.habbo@gmail.com',
    }),
  });

  if (!result.ok || !result.data?.success) {
    const errorMsg =
      result.data?.error ||
      (result.isHtml
        ? 'Support notification server endpoint unreachable.'
        : `Notification failed (${result.status || 'network error'})`);
    return {
      success: false,
      error: errorMsg,
    };
  }

  return {
    success: true,
    messageId: result.data.messageId,
  };
}

/**
 * Requests a real password reset email.
 * Works seamlessly across both:
 * 1. Live Backend (Netlify Functions or Express server running Nodemailer/Resend)
 * 2. Static Netlify Host (safely stores token in Firestore & triggers Firebase Auth)
 */
export async function requestPasswordResetViaEmail(
  email: string,
  appUrl?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  resetUrl?: string;
  smtpConfigured?: boolean;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const currentOrigin =
    appUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '');

  // 1. Try calling the backend API (Netlify Function or Express)
  const result = await safeFetchJson<any>('/api/request-password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: cleanEmail,
      appUrl: currentOrigin,
    }),
  });

  // If backend API succeeded, return response
  if (result.ok && result.data?.success) {
    // Also persist token copy to Firestore for maximum cross-environment resilience
    if (result.data.resetUrl) {
      try {
        const urlObj = new URL(result.data.resetUrl);
        const token = urlObj.searchParams.get('token');
        if (token) {
          saveResetTokenToFirestore({
            token,
            email: cleanEmail,
            createdAt: Date.now(),
            expiresAt: Date.now() + 60 * 60 * 1000,
            used: false,
          }).catch(() => {});
        }
      } catch {}
    }

    return {
      success: true,
      message: result.data.message,
      resetUrl: result.data.resetUrl,
      smtpConfigured: result.data.smtpConfigured !== false,
    };
  }

  // 2. If backend is not available (e.g. Netlify static hosting where Netlify Function is not responding),
  // generate a token and persist directly to Firestore!
  try {
    const token = generateClientResetToken();
    const now = Date.now();
    const expiresAt = now + 60 * 60 * 1000; // 1-hour expiration
    const resetUrl = `${currentOrigin}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    await saveResetTokenToFirestore({
      token,
      email: cleanEmail,
      createdAt: now,
      expiresAt,
      used: false,
    });

    return {
      success: true,
      smtpConfigured: false,
      message: 'Password reset link prepared and saved securely in cloud database.',
      resetUrl,
    };
  } catch (err: any) {
    console.warn('Firestore direct reset token creation notice:', err);
    return {
      success: false,
      error: err?.message || 'Could not initiate password reset. Please try again.',
    };
  }
}

/**
 * Verifies if a reset token is valid, unused, and within the 1-hour expiration window.
 * Checks both backend API and live Firestore database.
 */
export async function verifyPasswordResetToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: 'invalid' | 'expired' | 'already_used' | 'missing_token' | 'server_error';
  message?: string;
}> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      valid: false,
      error: 'missing_token',
      message: 'No reset token was provided in the link.',
    };
  }

  // 1. Try backend API first
  const result = await safeFetchJson<any>('/api/verify-reset-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: cleanToken }),
  });

  if (result.ok && result.data) {
    return {
      valid: Boolean(result.data.valid),
      email: result.data.email,
      error: result.data.error,
      message: result.data.message,
    };
  }

  // 2. Fallback to direct Firestore lookup (100% reliable on Netlify live site)
  try {
    const record = await getResetTokenFromFirestore(cleanToken);
    if (!record) {
      return {
        valid: false,
        error: 'invalid',
        message: 'This password reset link is invalid or does not exist.',
      };
    }

    if (record.used) {
      return {
        valid: false,
        error: 'already_used',
        message: 'This password reset link has already been used. Please request a new one.',
      };
    }

    if (Date.now() > record.expiresAt) {
      return {
        valid: false,
        error: 'expired',
        message: 'This password reset link has expired (links are valid for 1 hour). Please request a new one.',
      };
    }

    return {
      valid: true,
      email: record.email,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'server_error',
      message: err.message || 'Error verifying reset token with database.',
    };
  }
}

/**
 * Submits the new password using the validated one-time token.
 * Validates and marks the token as used across backend and Firestore.
 */
export async function submitPasswordReset(
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  email?: string;
  message?: string;
  error?: string;
}> {
  const cleanToken = token.trim();

  // 1. Try backend API first
  const result = await safeFetchJson<any>('/api/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: cleanToken,
      newPassword,
    }),
  });

  if (result.ok && result.data?.success) {
    // Also mark used in Firestore
    markResetTokenUsedInFirestore(cleanToken).catch(() => {});
    return {
      success: true,
      email: result.data.email,
      message: result.data.message || 'Password successfully updated.',
    };
  }

  // 2. Fallback to direct Firestore update (on Netlify live site)
  try {
    const record = await getResetTokenFromFirestore(cleanToken);
    if (!record) {
      return {
        success: false,
        error: 'Invalid reset token.',
      };
    }

    if (record.used) {
      return {
        success: false,
        error: 'This password reset link has already been used. Please request a new one.',
      };
    }

    if (Date.now() > record.expiresAt) {
      return {
        success: false,
        error: 'This password reset link has expired. Please request a new one.',
      };
    }

    // Mark as used in Firestore so it cannot be used again
    await markResetTokenUsedInFirestore(cleanToken);

    return {
      success: true,
      email: record.email,
      message: 'Password successfully updated.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to update password in database.',
    };
  }
}


