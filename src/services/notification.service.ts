import { Types } from "mongoose";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import Notification from "../models/notification.model";
import { globalServices } from "../server";
import { config } from "../config";

interface EmailOptions {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

interface SlackMessage {
  text?: string;
  blocks?: any[];
  attachments?: Array<{
    color?: string;
    title?: string;
    text?: string;
    fields?: Array<{
      title: string;
      value: string;
      short?: boolean;
    }>;
    footer?: string;
    ts?: number;
  }>;
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

interface WebhookOptions {
  url: string;
  payload: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
}

interface NotificationResult {
  success: boolean;
  channel: string;
  error?: string;
  statusCode?: number;
  duration?: number;
}

interface NotificationConfig {
  email?: {
    provider?: 'resend' | 'sendgrid' | 'ses' | 'smtp' | 'console';
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
    smtpConfig?: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
  };
  slack?: {
    defaultChannel?: string;
    defaultUsername?: string;
    defaultIconEmoji?: string;
  };
  webhook?: {
    defaultTimeout?: number;
    defaultRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
  rateLimiting?: {
    enabled: boolean;
    maxPerMinute?: number;
    maxPerHour?: number;
  };
}

interface RateLimitTracker {
  [key: string]: {
    minute: { count: number; resetTime: number };
    hour: { count: number; resetTime: number };
  };
}

export class NotificationService {
  // SMTP transporter for email
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  private static config: NotificationConfig = {
    email: {
      provider: (process.env.EMAIL_PROVIDER as NotificationConfig['email']['provider'])
        || (config.email.resendApiKey ? 'resend' : 'smtp'),
      fromEmail: process.env.FROM_EMAIL || process.env.SMTP_FROM || 'Apperio <femi@apperio.dev>',
      fromName: process.env.FROM_NAME || 'Apperio',
    },
    webhook: {
      defaultTimeout: 10000,
      defaultRetries: 3,
      defaultHeaders: { 'User-Agent': 'AlertSystem/1.0' },
    },
    rateLimiting: {
      enabled: process.env.NODE_ENV === 'production',
      maxPerMinute: 60,
      maxPerHour: 500,
    },
  };

  private static rateLimitTracker: RateLimitTracker = {};

  /**
   * Configure the notification service
   */
  static configure(config: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Send email notification with enhanced options
   */
  static async sendEmail(
    options: EmailOptions | string[],
    subject?: string,
    text?: string
  ): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      // Handle legacy signature for backward compatibility
      const emailOptions: EmailOptions = Array.isArray(options)
        ? { to: options, subject: subject!, text }
        : options;

      if (!emailOptions.to?.length) {
        return { success: false, channel: 'email', error: 'No recipients provided' };
      }

      // Rate limiting check
      if (!this.checkRateLimit('email', emailOptions.to.join(','))) {
        return { success: false, channel: 'email', error: 'Rate limit exceeded' };
      }

      const provider = this.config.email?.provider || 'smtp';

      switch (provider) {
        case 'resend':
          return await this.sendEmailViaResend(emailOptions);
        case 'sendgrid':
          return await this.sendEmailViaSendGrid(emailOptions);
        case 'ses':
          return await this.sendEmailViaSES(emailOptions);
        case 'smtp':
          return await this.sendEmailViaSMTP(emailOptions);
        default:
          // Console provider for development
          console.log(`[Email Notification] To: ${emailOptions.to.join(', ')}`);
          console.log(`[Email Notification] Subject: ${emailOptions.subject}`);
          console.log(`[Email Notification] Content: ${emailOptions.text || emailOptions.html}`);
          if (emailOptions.cc?.length) console.log(`[Email Notification] CC: ${emailOptions.cc.join(', ')}`);

          return {
            success: true,
            channel: 'email',
            duration: Date.now() - startTime
          };
      }
    } catch (error) {
      return {
        success: false,
        channel: 'email',
        error: (error as Error).message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Send Slack notification with rich message support
   */
  static async sendSlack(
    webhookUrl: string,
    message: string | SlackMessage
  ): Promise<NotificationResult> {
    const startTime = Date.now();

    if (!webhookUrl) {
      return { success: false, channel: 'slack', error: 'No webhook URL provided' };
    }

    if (!this.checkRateLimit('slack', webhookUrl)) {
      return { success: false, channel: 'slack', error: 'Rate limit exceeded' };
    }

    try {
      const payload: SlackMessage = typeof message === 'string'
        ? { text: message }
        : message;

      // Apply default Slack config
      if (this.config.slack) {
        payload.channel = payload.channel || this.config.slack.defaultChannel;
        payload.username = payload.username || this.config.slack.defaultUsername;
        payload.icon_emoji = payload.icon_emoji || this.config.slack.defaultIconEmoji;
      }

      const response = await this.makeHttpRequest({
        url: webhookUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 10000,
      });

      return {
        success: response.ok,
        channel: 'slack',
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'slack',
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Send Discord notification
   */
  static async sendDiscord(webhookUrl: string, message: string): Promise<NotificationResult> {
    const startTime = Date.now();

    if (!webhookUrl) {
      return { success: false, channel: 'discord', error: 'No webhook URL provided' };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });

      return {
        success: response.ok,
        channel: 'discord',
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error("Failed to send Discord notification", error);
      return {
        success: false,
        channel: 'discord',
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Send in-app notification
   */
  static async sendInApp(
    userId: string,
    type: "info" | "warning" | "error" | "success",
    message: string,
    metadata?: any
  ) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        message,
        metadata,
      });

      // Real-time update via WebSocket
      if (globalServices.dashboardWebSocketService) {
        globalServices.dashboardWebSocketService.sendToUser(
          userId,
          "NOTIFICATION",
          notification
        );
      }

      return notification;
    } catch (error) {
      console.error("[Notification] In-App failed:", error);
    }
  }

  /**
   * Send webhook notification with enhanced options
   */
  static async sendWebhook(
    options: WebhookOptions | string,
    payload?: any
  ): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      // Handle legacy signature for backward compatibility
      const webhookOptions: WebhookOptions = typeof options === 'string'
        ? { url: options, payload }
        : options;

      if (!webhookOptions.url) {
        return { success: false, channel: 'webhook', error: 'No webhook URL provided' };
      }

      if (!this.checkRateLimit('webhook', webhookOptions.url)) {
        return { success: false, channel: 'webhook', error: 'Rate limit exceeded' };
      }

      const {
        url,
        payload: webhookPayload,
        headers = {},
        timeout = this.config.webhook?.defaultTimeout || 10000,
        retries = this.config.webhook?.defaultRetries || 3,
        authentication
      } = webhookOptions;

      // Merge default headers
      const finalHeaders = {
        'Content-Type': 'application/json',
        ...this.config.webhook?.defaultHeaders,
        ...headers,
      };

      // Add authentication headers
      if (authentication) {
        switch (authentication.type) {
          case 'bearer':
            finalHeaders['Authorization'] = `Bearer ${authentication.token}`;
            break;
          case 'basic':
            const basicAuth = Buffer.from(`${authentication.username}:${authentication.password}`).toString('base64');
            finalHeaders['Authorization'] = `Basic ${basicAuth}`;
            break;
          case 'api-key':
            finalHeaders[authentication.headerName || 'X-API-Key'] = authentication.apiKey || '';
            break;
        }
      }

      const response = await this.makeHttpRequestWithRetry({
        url,
        method: 'POST',
        headers: finalHeaders,
        body: JSON.stringify(webhookPayload),
        timeout,
      }, retries);

      return {
        success: response.ok,
        channel: 'webhook',
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'webhook',
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Send notifications to multiple channels concurrently
   */
  static async sendMultiChannel(
    channels: Array<{
      type: 'email' | 'slack' | 'webhook' | 'discord' | 'inapp';
      options: any;
    }>
  ): Promise<NotificationResult[]> {
    const promises = channels.map(async (channel) => {
      try {
        switch (channel.type) {
          case 'email':
            return await this.sendEmail(channel.options);
          case 'slack':
            return await this.sendSlack(channel.options.webhookUrl, channel.options.message);
          case 'webhook':
            return await this.sendWebhook(channel.options);
          case 'discord':
            return await this.sendDiscord(channel.options.webhookUrl, channel.options.message);
          default:
            return { success: false, channel: channel.type, error: 'Unknown channel type' };
        }
      } catch (error) {
        return { success: false, channel: channel.type, error: error.message };
      }
    });

    return Promise.allSettled(promises).then(results =>
      results.map((result, index) =>
        result.status === 'fulfilled'
          ? result.value
          : { success: false, channel: channels[index].type, error: result.reason }
      )
    );
  }

  /**
   * Create formatted alert messages for different channels
   */
  static formatAlertMessage(alert: any, channel: 'email' | 'slack' | 'webhook') {
    const { title, message, severity, triggeredAt, environment, metadata } = alert;
    const timestamp = new Date(triggeredAt).toLocaleString();

    switch (channel) {
      case 'email':
        return {
          subject: `Alert: ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <div style="background: ${severity === 'critical' ? '#dc3545' : severity === 'warning' ? '#ffc107' : '#17a2b8'}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">${title}</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Severity: ${severity.toUpperCase()}</p>
              </div>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
                <p><strong>Message:</strong> ${message}</p>
                <p><strong>Triggered:</strong> ${timestamp}</p>
                ${environment ? `<p><strong>Environment:</strong> ${environment}</p>` : ''}
                ${metadata?.log?.message ? `<p><strong>Log Message:</strong> ${metadata.log.message}</p>` : ''}
              </div>
            </div>
          `,
          text: `${title}\n\nSeverity: ${severity.toUpperCase()}\nMessage: ${message}\nTriggered: ${timestamp}\n${environment ? `Environment: ${environment}\n` : ''}${metadata?.log?.message ? `Log Message: ${metadata.log.message}` : ''}`
        };

      case 'slack':
        return {
          text: `Alert: ${title}`,
          attachments: [{
            color: severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'good',
            fields: [
              { title: 'Severity', value: severity.toUpperCase(), short: true },
              { title: 'Status', value: alert.status || 'Active', short: true },
              { title: 'Message', value: message, short: false },
              ...(environment ? [{ title: 'Environment', value: environment, short: true }] : []),
              ...(metadata?.rule?.name ? [{ title: 'Rule', value: metadata.rule.name, short: true }] : []),
            ],
            footer: 'Alert System',
            ts: Math.floor(new Date(triggeredAt).getTime() / 1000)
          }]
        };

      case 'webhook':
        return {
          type: 'alert.triggered',
          alert,
          timestamp: new Date().toISOString(),
          formatted: {
            title,
            message,
            severity,
            triggeredAt,
            environment
          }
        };

      default:
        return alert;
    }
  }

  /**
   * Get notification statistics
   */
  static getNotificationStats() {
    const now = Date.now();
    const stats = {
      rateLimits: {} as Record<string, any>,
      totalTracked: Object.keys(this.rateLimitTracker).length,
    };

    Object.entries(this.rateLimitTracker).forEach(([key, tracker]) => {
      const [channel] = key.split(':');
      if (!stats.rateLimits[channel]) {
        stats.rateLimits[channel] = { minute: 0, hour: 0 };
      }

      if (tracker.minute.resetTime > now) {
        stats.rateLimits[channel].minute += tracker.minute.count;
      }
      if (tracker.hour.resetTime > now) {
        stats.rateLimits[channel].hour += tracker.hour.count;
      }
    });

    return stats;
  }

  /**
   * Clear rate limit tracking (useful for testing)
   */
  static clearRateLimits() {
    this.rateLimitTracker = {};
  }

  // === PRIVATE HELPER METHODS ===

  private static checkRateLimit(channel: string, identifier: string): boolean {
    if (!this.config.rateLimiting?.enabled) return true;

    const key = `${channel}:${identifier}`;
    const now = Date.now();
    const tracker = this.rateLimitTracker[key] || {
      minute: { count: 0, resetTime: now + 60000 },
      hour: { count: 0, resetTime: now + 3600000 }
    };

    // Reset counters if time has passed
    if (tracker.minute.resetTime <= now) {
      tracker.minute = { count: 0, resetTime: now + 60000 };
    }
    if (tracker.hour.resetTime <= now) {
      tracker.hour = { count: 0, resetTime: now + 3600000 };
    }

    // Check limits
    const maxPerMinute = this.config.rateLimiting.maxPerMinute || 60;
    const maxPerHour = this.config.rateLimiting.maxPerHour || 500;

    if (tracker.minute.count >= maxPerMinute || tracker.hour.count >= maxPerHour) {
      return false;
    }

    // Increment counters
    tracker.minute.count++;
    tracker.hour.count++;
    this.rateLimitTracker[key] = tracker;

    return true;
  }

  private static async makeHttpRequest(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    timeout: number;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static async makeHttpRequestWithRetry(
    options: Parameters<typeof this.makeHttpRequest>[0],
    retries: number
  ) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.makeHttpRequest(options);

        // Don't retry on client errors (4xx), only server errors (5xx) or network issues
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError;
  }

  // Email provider implementations
  private static async sendEmailViaResend(options: EmailOptions): Promise<NotificationResult> {
    const startTime = Date.now();
    try {
      const apiKey = config.email.resendApiKey;
      if (!apiKey) {
        console.warn('[Resend] No API key configured, falling back to console');
        console.log(`[Email] To: ${options.to.join(', ')}, Subject: ${options.subject}`);
        return { success: true, channel: 'email', duration: Date.now() - startTime };
      }

      const resend = new Resend(apiKey);
      const fromAddress = this.config.email?.fromEmail || 'Apperio <notifications@apperio.dev>';

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html || options.text || '',
        ...(options.cc?.length ? { cc: options.cc } : {}),
        ...(options.bcc?.length ? { bcc: options.bcc } : {}),
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      });

      if (error) {
        console.error('[Resend] Email send error:', error);
        return {
          success: false,
          channel: 'email',
          error: error.message,
          duration: Date.now() - startTime,
        };
      }

      console.log(`[Resend] Email sent successfully: ${data?.id}`);
      return {
        success: true,
        channel: 'email',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Resend] Email failed:', error);
      return {
        success: false,
        channel: 'email',
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  private static async sendEmailViaSendGrid(options: EmailOptions): Promise<NotificationResult> {
    // Implementation would use @sendgrid/mail
    console.log('[SendGrid] Not implemented, falling back to console');
    console.log(`[Email] To: ${options.to.join(', ')}, Subject: ${options.subject}`);
    return { success: true, channel: 'email' };
  }

  private static async sendEmailViaSES(options: EmailOptions): Promise<NotificationResult> {
    // Implementation would use AWS SDK
    console.log('[SES] Not implemented, falling back to console');
    console.log(`[Email] To: ${options.to.join(', ')}, Subject: ${options.subject}`);
    return { success: true, channel: 'email' };
  }

  private static async sendEmailViaSMTP(options: EmailOptions): Promise<NotificationResult> {
    const startTime = Date.now();
    try {
      const info = await this.transporter.sendMail({
        from: `"${this.config.email?.fromName || 'Apperio'}" <${this.config.email?.fromEmail || process.env.SMTP_FROM || 'no-reply@apperio.dev'}>`,
        to: options.to.join(", "),
        cc: options.cc?.join(", "),
        bcc: options.bcc?.join(", "),
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });
      console.log(`[Notification] Email sent: ${info.messageId}`);
      return {
        success: true,
        channel: 'email',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[Notification] Email failed:", error);
      return {
        success: false,
        channel: 'email',
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }
}
