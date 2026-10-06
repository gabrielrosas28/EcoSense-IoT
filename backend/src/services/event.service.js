import { config } from "../config/env.js";
import * as events from "../repositories/event.repository.js";

const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: config.timezone,
});

export async function listEvents({ limit, device }) {
  const recent = await events.findRecent({ limit, deviceId: device });
  return recent.map((event) => ({ ...event, at: timeLabel.format(event.createdAt) }));
}
