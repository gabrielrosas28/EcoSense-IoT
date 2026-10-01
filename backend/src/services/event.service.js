import { config } from "../config/env.js";
import * as events from "../repositories/event.repository.js";

// O EventList do frontend mostra a hora pronta ("07:12"), no fuso da escola.
const timeLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: config.timezone,
});

/** Histórico do dashboard: `at` é o rótulo de exibição, `createdAt` o instante exato. */
export async function listEvents({ limit, device }) {
  const recent = await events.findRecent({ limit, deviceId: device });
  return recent.map((event) => ({ ...event, at: timeLabel.format(event.createdAt) }));
}
