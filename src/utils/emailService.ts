import { SupportRequest } from '../types';

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
 * Checks if the backend has GMAIL_APP_PASSWORD configured for sending real emails.
 */
export async function checkEmailConfigStatus(): Promise<EmailConfigStatus> {
  try {
    const res = await fetch('/api/email-status');
    if (!res.ok) {
      return { configured: false, sender: 'aymane.habbo@gmail.com' };
    }
    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      sender: data.sender || 'aymane.habbo@gmail.com',
    };
  } catch (err) {
    console.warn('Failed to check email config status:', err);
    return { configured: false, sender: 'aymane.habbo@gmail.com' };
  }
}

/**
 * Sends a real email through Gmail SMTP via the Express server API.
 */
export async function sendEmailViaSMTP(payload: SendEmailPayload): Promise<SendEmailResult> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Failed to send email (${res.status})`,
      };
    }

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error while contacting email service',
    };
  }
}

/**
 * Forwards a support request or listener report directly to aymane.habbo@gmail.com
 */
export async function forwardSupportRequestViaSMTP(request: SupportRequest): Promise<SendEmailResult> {
  try {
    const res = await fetch('/api/support-notification', {
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

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `SMTP forwarding failed (${res.status})`,
      };
    }

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to dispatch notification to email server',
    };
  }
}

/**
 * Requests a real password reset email to be sent from aymane.habbo@gmail.com
 */
export async function requestPasswordResetViaEmail(email: string, appUrl?: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  resetUrl?: string;
  smtpConfigured?: boolean;
}> {
  try {
    const res = await fetch('/api/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        appUrl: appUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : undefined),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Password reset request failed (${res.status})`,
      };
    }

    return {
      success: true,
      message: data.message,
      resetUrl: data.resetUrl,
      smtpConfigured: data.smtpConfigured !== false,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to contact password reset service',
    };
  }
}

/**
 * Verifies if a reset token is valid, unused, and within the 1-hour expiration window.
 */
export async function verifyPasswordResetToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: 'invalid' | 'expired' | 'already_used' | 'missing_token' | 'server_error';
  message?: string;
}> {
  try {
    const res = await fetch('/api/verify-reset-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token.trim() }),
    });

    const data = await res.json();
    if (!res.ok || !data.valid) {
      return {
        valid: false,
        error: data.error || 'invalid',
        message: data.message || 'This password reset link is invalid or expired.',
      };
    }

    return {
      valid: true,
      email: data.email,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'server_error',
      message: err.message || 'Network error verifying reset link.',
    };
  }
}

/**
 * Submits the new password using the validated one-time token.
 */
export async function submitPasswordReset(token: string, newPassword: string): Promise<{
  success: boolean;
  email?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token.trim(),
        newPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to update password.',
      };
    }

    return {
      success: true,
      email: data.email,
      message: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error updating password.',
    };
  }
}

