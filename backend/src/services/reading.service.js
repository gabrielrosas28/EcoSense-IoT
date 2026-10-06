import { config } from "../config/env.js";
import { DEVICE_CATALOG } from "../domain/devices.js";
import { HttpError } from "../lib/httpError.js";
import { z } from "../lib/zod.js";
import * as readings from "../repositories/reading.repository.js";
import { READING_INTERVALS } from "../schemas/device.schemas.js";
import { getDevice } from "./device.service.js";

export async function listReadings(id, { sensor, from, to, interval, limit }) {
  const device = await getDevice(id);
  const sensors = sensorsOf(device, sensor);

  const series = Object.fromEntries(sensors.map((name) => [name, []]));
  if (sensors.length > 0) {
    const query = { deviceId: id, sensors, from, to, limit };
    if (interval) {
      const rows = await readings.findBuckets({ ...query, interval: READING_INTERVALS[interval], timezone: config.timezone });
      for (const { sensor: name, avg, ...point } of rows) {
        series[name].push({ at: point.at, value: round(avg), min: point.min, max: point.max, count: point.count });
      }
    } else {
      const rows = await readings.findRaw(query);
      const booleans = new Set(sensors.filter((name) => isBoolean(id, name)));
      for (const { sensor: name, at, value } of rows) {
        series[name].push({ at, value: booleans.has(name) ? value === 1 : value });
      }
    }
  }

  return { device: id, from, to, interval: interval ?? null, series };
}

function sensorsOf(device, sensor) {
  const available = Object.keys(DEVICE_CATALOG[device.id]?.sensors ?? {});
  if (sensor === undefined) return available;
  if (!available.includes(sensor)) {
    const erro = available.length > 0 ? `use um destes: ${available.join(", ")}` : `${device.name} não tem sensores`;
    throw HttpError.badRequest(`Sensor "${sensor}" não existe em ${device.name}`, [{ campo: "sensor", erro }]);
  }
  return [sensor];
}

function isBoolean(id, sensor) {
  return DEVICE_CATALOG[id].sensors[sensor] instanceof z.ZodBoolean;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
