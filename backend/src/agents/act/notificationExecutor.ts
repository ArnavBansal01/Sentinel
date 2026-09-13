export interface NotificationProvider {
  send(
    payload: unknown,
  ): Promise<{ delivery: "delivered" | "simulated_external_delivery"; provider: string }>;
}
export class ConsoleNotificationProvider implements NotificationProvider {
  async send(payload: unknown) {
    console.info("[NOTIFICATION] simulated", payload);
    return { delivery: "simulated_external_delivery" as const, provider: "console" };
  }
}
export class WebhookNotificationProvider implements NotificationProvider {
  constructor(private url: string) {}
  async send(payload: unknown) {
    const r = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`webhook_status_${r.status}`);
    return { delivery: "delivered" as const, provider: "webhook" };
  }
}
