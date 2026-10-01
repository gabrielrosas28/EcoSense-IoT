import mqtt, { type MqttClient } from "mqtt";
import type { Config } from "./config.ts";
import { type DeviceCommand, type DeviceSlug, TOPIC } from "./contract.ts";
import { advance, applyCommand, createState, type Rng, type SimState, toStatus } from "./devices.ts";
import { log } from "./log.ts";

/**
 * Liga o modelo (`devices.ts`) ao broker.
 *
 * Um cliente MQTT por dispositivo, como se cada um fosse um ESP32: cada um tem
 * o próprio Last Will (`{ "online": false }` retido no tópico de status), então
 * derrubar um dispositivo não derruba os outros e o backend é avisado pelo
 * broker, não pelo simulador.
 *
 * Status sai retido (QoS 1): quem assinar depois recebe o último estado na hora.
 */
export class Simulator {
  readonly state: SimState = createState();
  private readonly clients = new Map<DeviceSlug, MqttClient>();
  private tickTimer: NodeJS.Timeout | undefined;
  private publishTimer: NodeJS.Timeout | undefined;
  private readonly config: Config;
  private readonly rng: Rng;

  constructor(config: Config, rng: Rng) {
    this.config = config;
    this.rng = rng;
  }

  start(): void {
    for (const slug of this.config.devices) this.connect(slug);

    const dt = (this.config.tickMs / 1000) * this.config.speed;
    this.tickTimer = setInterval(() => this.step(dt), this.config.tickMs);
    this.publishTimer = setInterval(() => this.publishAll(), this.config.publishMs);
  }

  /** Desliga com elegância: avisa offline (retido) e fecha as conexões. */
  async stop(): Promise<void> {
    clearInterval(this.tickTimer);
    clearInterval(this.publishTimer);
    await Promise.all(
      [...this.clients.entries()].map(async ([slug, client]) => {
        if (client.connected) {
          await client.publishAsync(TOPIC.status(slug), JSON.stringify({ online: false }), {
            qos: 1,
            retain: true,
          });
        }
        await client.endAsync();
      }),
    );
    this.clients.clear();
  }

  // ---------- conexão ----------

  private connect(slug: DeviceSlug): void {
    const statusTopic = TOPIC.status(slug);
    const cmdTopic = TOPIC.command(slug);

    const client = mqtt.connect(this.config.mqttUrl, {
      clientId: `ecosense-sim-${slug}-${Math.random().toString(16).slice(2, 8)}`,
      username: this.config.mqttUsername,
      password: this.config.mqttPassword,
      reconnectPeriod: 2000,
      will: {
        topic: statusTopic,
        payload: Buffer.from(JSON.stringify({ online: false })),
        qos: 1,
        retain: true,
      },
    });
    this.clients.set(slug, client);

    // Sem broker o mqtt.js tenta de novo a cada 2 s: avisa uma vez só, não a cada tentativa.
    let avisouErro = false;

    client.on("connect", () => {
      avisouErro = false;
      log.info(slug, `conectado em ${this.config.mqttUrl}`);
      client.subscribe(cmdTopic, { qos: 1 }, (err) => {
        if (err) log.error(slug, `falha ao assinar ${cmdTopic}: ${err.message}`);
      });
      this.publish(slug);
    });

    client.on("message", (_topic, raw) => this.onCommand(slug, raw.toString()));
    client.on("error", (err) => {
      if (avisouErro) return;
      avisouErro = true;
      log.error(slug, `${err.message} — tentando reconectar a cada 2 s`);
    });
  }

  // ---------- entrada: comandos ----------

  private onCommand(slug: DeviceSlug, raw: string): void {
    let command: DeviceCommand;
    try {
      command = JSON.parse(raw) as DeviceCommand;
      if (!command || typeof command.action !== "string") throw new Error("sem `action`");
    } catch (err) {
      log.warn(slug, `comando inválido ignorado: ${raw} (${(err as Error).message})`);
      return;
    }

    log.cmd(slug, raw);
    const result = applyCommand(this.state, slug, command);
    if (result.ok) log.info(slug, result.message);
    else log.warn(slug, result.message);

    // O status é a confirmação: o backend/painel vê o estado que o device aceitou.
    this.publish(slug);
  }

  // ---------- saída: status ----------

  private step(dt: number): void {
    const changes = advance(this.state, dt, this.rng);
    const mudaram = new Set<DeviceSlug>();
    for (const change of changes) {
      log.info(change.slug, change.message);
      mudaram.add(change.slug);
    }
    // Presença mexe na luz, mas o projetor também usa — publica os dois.
    if (mudaram.has("luz")) mudaram.add("projetor");
    for (const slug of mudaram) this.publish(slug);
  }

  publishAll(): void {
    for (const slug of this.config.devices) this.publish(slug, this.config.verbose);
  }

  /** Publica o status atual. `verbose = false` evita poluir o log com o periódico. */
  publish(slug: DeviceSlug, verbose = true): void {
    const client = this.clients.get(slug);
    if (!client?.connected || !this.state[slug].online) return;
    const payload = JSON.stringify(toStatus(this.state, slug));
    client.publish(TOPIC.status(slug), payload, { qos: 1, retain: true });
    if (verbose) log.status(slug, payload);
  }

  // ---------- falhas simuladas (console) ----------

  /**
   * Simula queda de energia: derruba o socket sem DISCONNECT, então o broker
   * dispara o Last Will — exatamente o que aconteceria com o ESP32.
   */
  goOffline(slug: DeviceSlug): void {
    const client = this.clients.get(slug);
    if (!client || !this.state[slug].online) return;
    this.state[slug].online = false;
    this.clients.delete(slug);
    client.end(true);
    log.warn(slug, "OFFLINE (queda simulada — o broker publica o Last Will)");
  }

  goOnline(slug: DeviceSlug): void {
    if (this.state[slug].online || !this.config.devices.includes(slug)) return;
    this.state[slug].online = true;
    this.connect(slug);
  }
}
