import { describe, expect, it } from "vitest";
import {
  serializeDevice,
  serializeEnvironment,
  serializeEvent,
  serializeReading,
  serializeRoutine,
  serializeUser,
} from "../../src/utils/serializers.ts";
import { deviceRow, environmentRow, routineRow, userRow } from "../helpers/fixtures.ts";

/**
 * Os serializers são o contrato com o frontend. Se um destes testes quebrar,
 * a UI quebra junto — confira `frontend/src/store/useDevices.js` antes de
 * ajustar a expectativa.
 */
describe("serializeDevice", () => {
  it("devolve o mesmo shape que o store do frontend consome", () => {
    expect(serializeDevice({ ...deviceRow(), environment: environmentRow() })).toEqual({
      id: "irrigacao",
      name: "Irrigação",
      accent: "var(--leaf)",
      on: false,
      mode: "auto",
      online: true,
      reading: { soil: 45, threshold: 30, maxPumpSec: 10 },
      lastSeen: null,
      environment: { id: "sala-101", name: "Sala 101" },
    });
  });

  it("resume o ambiente a slug + nome, sem vazar o UUID", () => {
    const dto = serializeDevice({ ...deviceRow(), environment: environmentRow() });
    expect(dto.environment).toEqual({ id: "sala-101", name: "Sala 101" });
    expect(JSON.stringify(dto)).not.toContain(environmentRow().id);
  });

  it("aceita dispositivo ainda sem ambiente definido", () => {
    expect(serializeDevice(deviceRow()).environment).toBeNull();
  });

  it("expõe o slug como `id` (o frontend não conhece o UUID)", () => {
    const dto = serializeDevice(deviceRow({ slug: "luz" }));
    expect(dto.id).toBe("luz");
    expect(dto).not.toHaveProperty("slug");
  });

  it("traduz o enum do banco para o modo em minúsculas", () => {
    expect(serializeDevice(deviceRow({ mode: "MANUAL" })).mode).toBe("manual");
    expect(serializeDevice(deviceRow({ mode: "AUTO" })).mode).toBe("auto");
  });

  it("nunca devolve `reading` nulo, mesmo sem settings", () => {
    expect(serializeDevice(deviceRow({ settings: null })).reading).toEqual({});
  });
});

describe("serializeRoutine", () => {
  it("estrutura a regra em `if` / `then` com o slug do dispositivo", () => {
    expect(serializeRoutine(routineRow())).toMatchObject({
      enabled: true,
      if: { sensor: "soil", operator: "<", value: 30 },
      then: { action: "ligar", device: "irrigacao" },
    });
  });
});

describe("serializeEvent", () => {
  it("renomeia `message` para `text`, como o EventList espera", () => {
    const dto = serializeEvent({
      id: "e1",
      deviceId: null,
      message: "Irrigação concluída",
      source: "DEVICE",
      createdAt: new Date("2026-01-01T07:12:00Z"),
      device: { slug: "irrigacao" },
    });
    expect(dto.text).toBe("Irrigação concluída");
    expect(dto.device).toBe("irrigacao");
  });

  it("aceita evento sem dispositivo", () => {
    expect(
      serializeEvent({
        id: "e2",
        deviceId: null,
        message: "Sistema iniciado",
        source: "SYSTEM",
        createdAt: new Date(),
        device: null,
      }).device,
    ).toBeNull();
  });
});

describe("serializeEnvironment", () => {
  it("expõe o slug como `id`, igual ao dispositivo", () => {
    expect(serializeEnvironment(environmentRow())).toEqual({
      id: "sala-101",
      name: "Sala 101",
      description: "Sala de aula do bloco A",
      location: "Bloco A - 2o andar",
    });
  });
});

describe("serializeReading", () => {
  it("renomeia `readAt` para `at` e usa o slug do dispositivo", () => {
    const dto = serializeReading({
      id: "r1",
      deviceId: deviceRow().id,
      environmentId: null,
      metric: "soil",
      value: 22,
      unit: "%",
      readAt: new Date("2026-01-01T07:12:00Z"),
      device: { slug: "irrigacao" },
    });
    expect(dto).toMatchObject({ device: "irrigacao", metric: "soil", value: 22, unit: "%" });
    expect(dto.at).toEqual(new Date("2026-01-01T07:12:00Z"));
  });
});

describe("serializeUser", () => {
  it("não vaza o hash da senha", () => {
    const dto = serializeUser(userRow());
    expect(dto).toEqual({
      id: userRow().id,
      email: "admin@ecosense.local",
      name: "Administrador",
    });
    expect(JSON.stringify(dto)).not.toContain("$2b$");
  });
});
