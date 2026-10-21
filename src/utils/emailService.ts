import { SupportRequest } from '../types';
import {
  firebaseSendPasswordReset,
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
 * Checks if the backend has GMAIL_APP_PASSWORD configured.
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
 * Sends a real email through Gmail SMTP via backend API.
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

export interface RequestPasswordResetResult {
  success: boolean;
  emailSent: boolean;
  provider?: 'smtp' | 'firebase' | 'none' | string;
  messageId?: string;
  message?: string;
  error?: string;
  warning?: string;
  resetUrl?: string;
  smtpConfigured?: boolean;
}

/**
 * Requests a real password reset email using Firebase Auth's built-in reset email.
 */
export async function requestPasswordResetViaEmail(
  email: string,
  _appUrl?: string
): Promise<RequestPasswordResetResult> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    await firebaseSendPasswordReset(cleanEmail);
  } catch (err: any) {
    console.warn('[Email Service] Firebase Auth password reset notice:', err);
  }

  // Always return neutral success so nobody can discover which emails exist
  return {
    success: true,
    emailSent: true,
    provider: 'firebase',
    message: 'If an account exists for this email, a reset link has been sent.',
    smtpConfigured: false,
  };
}

/**
 * Legacy stub for backward compatibility
 */
export async function verifyPasswordResetToken(_token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: 'invalid' | 'expired' | 'already_used' | 'missing_token' | 'server_error';
  message?: string;
}> {
  return {
    valid: false,
    error: 'invalid',
    message: 'Password reset is managed securely by the Firebase email link.',
  };
}

/**
 * Legacy stub for backward compatibility
 */
export async function submitPasswordReset(
  _token: string,
  _newPassword: string
): Promise<{
  success: boolean;
  email?: string;
  message?: string;
  error?: string;
}> {
  return {
    success: false,
    error: 'Please use the password reset link sent to your email by Firebase.',
  };
}


