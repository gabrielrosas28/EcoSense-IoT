import { createInterface } from "node:readline";
import { DEVICE_SLUGS, isDeviceSlug } from "./contract.ts";
import { toStatus } from "./devices.ts";
import type { Simulator } from "./simulator.ts";

/**
 * Console interativo: força cenários sem esperar o acaso.
 * Útil em demonstração ("solo secou → a bomba liga") e para testar o backend.
 */

const AJUDA = `
Comandos:
  status                         mostra o estado de todos os dispositivos
  presenca on|off                força o sensor de presença da sala
  set <device> <chave> <valor>   altera uma leitura (ex.: set irrigacao soil 20)
  offline <device>               simula queda (o broker publica o Last Will)
  online <device>                religa o dispositivo
  publicar                       publica o status de todos agora
  ajuda                          mostra esta ajuda
  sair                           encerra (publica online=false antes)
Dispositivos: ${DEVICE_SLUGS.join(", ")}
`;

function parseValor(raw: string): unknown {
  if (raw === "true" || raw === "on") return true;
  if (raw === "false" || raw === "off") return false;
  const n = Number(raw);
  return Number.isFinite(n) && raw !== "" ? n : raw;
}

export function startConsole(sim: Simulator, onQuit: () => void): void {
  if (!process.stdin.isTTY) return;
  console.log('Console ativo — digite "ajuda".');

  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const [cmd, ...args] = line.trim().split(/\s+/);
    switch (cmd) {
      case undefined:
      case "":
        return;

      case "status":
        for (const slug of DEVICE_SLUGS) {
          console.log(`  ${slug.padEnd(12)} ${JSON.stringify(toStatus(sim.state, slug))}`);
        }
        return;

      case "presenca": {
        sim.state.luz.reading.presenca = args[0] === "on" || args[0] === "true";
        sim.publish("luz");
        sim.publish("projetor");
        return;
      }

      case "set": {
        const [slug, key, raw] = args;
        if (!slug || !isDeviceSlug(slug) || !key || raw === undefined) {
          console.log("uso: set <device> <chave> <valor>");
          return;
        }
        const reading = sim.state[slug].reading as Record<string, unknown>;
        if (!(key in reading)) {
          console.log(`"${key}" não existe em ${slug}: ${Object.keys(reading).join(", ")}`);
          return;
        }
        reading[key] = parseValor(raw);
        sim.publish(slug);
        return;
      }

      case "offline":
      case "online": {
        const slug = args[0];
        if (!slug || !isDeviceSlug(slug)) {
          console.log(`uso: ${cmd} <${DEVICE_SLUGS.join("|")}>`);
          return;
        }
        if (cmd === "offline") sim.goOffline(slug);
        else sim.goOnline(slug);
        return;
      }

      case "publicar":
        sim.publishAll();
        return;

      case "ajuda":
      case "help":
        console.log(AJUDA);
        return;

      case "sair":
      case "quit":
      case "exit":
        rl.close();
        onQuit();
        return;

      default:
        console.log(`comando desconhecido: ${cmd} — digite "ajuda"`);
    }
  });
}
