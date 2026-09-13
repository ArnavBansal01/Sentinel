import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { repository } from "../persistence/database.js";
import type { ActivityEvent, Agent } from "../types/domain.js";
class Bus extends EventEmitter {
  emitEvent(input: Omit<ActivityEvent, "id" | "timestamp">) {
    const event: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
    };
    repository.addActivity(event);
    this.emit("event", event);
    console.info(`[${event.agent.toUpperCase()}] ${event.message}`);
    return event;
  }
}
export const eventBus = new Bus();
export function publish(
  traceId: string,
  agent: Agent,
  eventType: string,
  shipmentId: string,
  message: string,
  data?: unknown,
) {
  return eventBus.emitEvent({
    traceId,
    agent,
    eventType,
    shipmentId,
    message,
    ...(data === undefined ? {} : { data }),
  });
}
