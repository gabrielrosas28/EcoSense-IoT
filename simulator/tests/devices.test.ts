import { describe, expect, it } from "vitest";
import { advance, applyCommand, createState, seededRng, tick, toStatus } from "../src/devices.ts";

/** RNG que nunca dispara eventos aleatórios (presença fixa; ruído desprezível). */
const calmo = () => 0.9999;

describe("estado inicial", () => {
  it("bate com o seed do backend e o store do frontend", () => {
    const s = createState();
    expect(toStatus(s, "irrigacao")).toEqual({
      on: false, mode: "auto", online: true, soil: 45, threshold: 30, maxPumpSec: 10,
    });
    expect(toStatus(s, "luz")).toEqual({
      on: true, mode: "auto", online: true, presenca: true, sleepMin: 10,
    });
  });

  it("não vaza contadores internos no payload", () => {
    const status = toStatus(createState(), "irrigacao");
    expect(status).not.toHaveProperty("bombaS");
  });
});

describe("comandos", () => {
  it("power liga e desliga", () => {
    const s = createState();
    expect(applyCommand(s, "projetor", { action: "power", value: "on" }).ok).toBe(true);
    expect(s.projetor.on).toBe(true);
    applyCommand(s, "projetor", { action: "power", value: "off" });
    expect(s.projetor.on).toBe(false);
  });

  it("mode aceita só auto/manual", () => {
    const s = createState();
    expect(applyCommand(s, "luz", { action: "mode", value: "manual" }).ok).toBe(true);
    expect(s.luz.mode).toBe("manual");
    expect(applyCommand(s, "luz", { action: "mode", value: "turbo" }).ok).toBe(false);
    expect(s.luz.mode).toBe("manual");
  });

  it("threshold altera só a chave pedida", () => {
    const s = createState();
    applyCommand(s, "irrigacao", { action: "threshold", key: "threshold", value: 25 });
    expect(s.irrigacao.reading).toMatchObject({ threshold: 25, maxPumpSec: 10 });
  });

  it("config ignora chaves desconhecidas e tipos errados", () => {
    const s = createState();
    const r = applyCommand(s, "irrigacao", { action: "config", maxPumpSec: 12, soil: 99, threshold: "x" });
    expect(r.ok).toBe(true);
    expect(s.irrigacao.reading).toEqual({ soil: 45, threshold: 30, maxPumpSec: 12 });
  });

  it("IR troca a fonte do projetor", () => {
    const s = createState();
    applyCommand(s, "projetor", { action: "ir", key: "source:VGA" });
    expect(s.projetor.reading.fonte).toBe("VGA");
    expect(applyCommand(s, "projetor", { action: "ir", key: "vol+" }).ok).toBe(true);
    expect(applyCommand(s, "projetor", { action: "ir", key: "source:DVI" }).ok).toBe(false);
  });

  it("dispositivo offline perde o comando", () => {
    const s = createState();
    s.luz.online = false;
    expect(applyCommand(s, "luz", { action: "power", value: "off" }).ok).toBe(false);
    expect(s.luz.on).toBe(true);
  });
});

describe("física", () => {
  it("irrigação liga abaixo do limite e respeita maxPumpSec", () => {
    const s = createState();
    s.irrigacao.reading.soil = 29;
    tick(s, 1, calmo);
    expect(s.irrigacao.on).toBe(true);

    for (let i = 0; i < 10; i++) tick(s, 1, calmo);
    expect(s.irrigacao.on).toBe(false);
    expect(s.irrigacao.reading.soil).toBeGreaterThan(29);
  });

  it("no manual a irrigação não liga sozinha", () => {
    const s = createState();
    s.irrigacao.mode = "manual";
    s.irrigacao.reading.soil = 10;
    tick(s, 1, calmo);
    expect(s.irrigacao.on).toBe(false);
  });

  it("trava da bomba vale também no manual", () => {
    const s = createState();
    s.irrigacao.mode = "manual";
    applyCommand(s, "irrigacao", { action: "power", value: "on" });
    for (let i = 0; i < 11; i++) tick(s, 1, calmo);
    expect(s.irrigacao.on).toBe(false);
  });

  it("umidificador tem histerese", () => {
    const s = createState();
    s.umidificador.on = false;
    s.umidificador.reading.air = 79;
    tick(s, 1, calmo);
    expect(s.umidificador.on).toBe(true);

    s.umidificador.reading.air = 80.5; // passou do limite, mas dentro da folga
    tick(s, 0.01, calmo);
    expect(s.umidificador.on).toBe(true);

    s.umidificador.reading.air = 86;
    tick(s, 0.01, calmo);
    expect(s.umidificador.on).toBe(false);
  });

  it("luz apaga após sleepMin sem presença (auto)", () => {
    const s = createState();
    s.luz.reading.presenca = false;
    tick(s, 9 * 60, calmo);
    expect(s.luz.on).toBe(true);
    tick(s, 61, calmo);
    expect(s.luz.on).toBe(false);
  });

  it("projetor desliga sozinho quando autoOff está ligado", () => {
    const s = createState();
    s.luz.reading.presenca = false;
    applyCommand(s, "projetor", { action: "power", value: "on" });
    tick(s, 16 * 60, calmo);
    expect(s.projetor.on).toBe(false);
  });

  it("leituras ficam entre 0 e 100", () => {
    const s = createState();
    const rng = seededRng(7);
    for (let i = 0; i < 5000; i++) tick(s, 5, rng);
    for (const v of [s.irrigacao.reading.soil, s.umidificador.reading.air]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("mesma semente → mesma simulação", () => {
    const a = createState();
    const b = createState();
    const ra = seededRng(42);
    const rb = seededRng(42);
    for (let i = 0; i < 200; i++) {
      tick(a, 10, ra);
      tick(b, 10, rb);
    }
    expect(a).toEqual(b);
  });
});

describe("advance", () => {
  it("acelerar o tempo não faz o umidificador oscilar", () => {
    const s = createState();
    s.umidificador.on = false;
    s.umidificador.reading.air = 70;
    // 10 minutos num passo só (equivale a SIM_SPEED alto)
    advance(s, 600, calmo);
    expect(s.umidificador.reading.air).toBeGreaterThanOrEqual(78);
    expect(s.umidificador.reading.air).toBeLessThanOrEqual(86);
  });
});
