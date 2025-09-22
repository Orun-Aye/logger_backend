// @ts-nocheck

export class NotificationService {
  static async sendEmail(to: string[], subject: string, text: string) {
    if (!to?.length) return;
    // Placeholder: integrate with real provider (e.g., SendGrid, SES)
    console.log(`[Notification] Email -> ${to.join(', ')} | ${subject}`);
  }

  static async sendSlack(webhookUrl: string, message: string) {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
    } catch (err) {
      console.error('Failed to send Slack notification', err);
    }
  }

  static async sendWebhook(url: string, payload: any) {
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to send webhook notification', err);
    }
  }
}


