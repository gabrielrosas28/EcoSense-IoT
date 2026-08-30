import type { Prisma } from "../generated/prisma/client.ts";
import { disconnectDatabase, prisma } from "../src/lib/prisma.ts";
import { hashPassword } from "../src/services/auth.service.ts";

/**
 * Popula o banco com os 4 dispositivos do projeto e um usuário de teste.
 * Os valores são exatamente os do mock do frontend (`store/useDevices.js`),
 * então a UI se comporta igual com ou sem backend.
 *
 * Rode: npm run db:seed
 */

const environments: Prisma.EnvironmentCreateInput[] = [
  {
    slug: "sala-101",
    name: "Sala 101",
    description: "Sala de aula monitorada (iluminação e projetor)",
    location: "Bloco A - 2o andar",
  },
  {
    slug: "estufa",
    name: "Estufa",
    description: "Cultivo monitorado (irrigação e umidificador)",
    location: "Pátio dos fundos",
  },
];

/** Em que ambiente cada dispositivo é instalado pelo seed. */
const ONDE_FICA: Record<string, string> = {
  luz: "sala-101",
  projetor: "sala-101",
  irrigacao: "estufa",
  umidificador: "estufa",
};

type DeviceSeed = Omit<Prisma.DeviceCreateInput, "environment">;

const devices: DeviceSeed[] = [
  {
    slug: "luz",
    name: "Iluminação",
    kind: "LIGHT",
    accent: "var(--amber)",
    isOn: true,
    mode: "AUTO",
    settings: { presenca: true, sleepMin: 10 },
  },
  {
    slug: "projetor",
    name: "Projetor",
    kind: "PROJECTOR",
    accent: "var(--blue)",
    isOn: false,
    mode: "MANUAL",
    settings: { fonte: "HDMI 1", autoOff: true, autoOffMin: 15 },
  },
  {
    slug: "irrigacao",
    name: "Irrigação",
    kind: "IRRIGATION",
    accent: "var(--leaf)",
    isOn: false,
    mode: "AUTO",
    settings: { soil: 45, threshold: 30, maxPumpSec: 10 },
  },
  {
    slug: "umidificador",
    name: "Umidificador",
    kind: "HUMIDIFIER",
    accent: "var(--teal)",
    isOn: true,
    mode: "AUTO",
    settings: { air: 58, threshold: 80 },
  },
];

async function main(): Promise<void> {
  const idPorSlug = new Map<string, string>();
  for (const environment of environments) {
    const criado = await prisma.environment.upsert({
      where: { slug: environment.slug },
      update: { name: environment.name, location: environment.location },
      create: environment,
    });
    idPorSlug.set(criado.slug, criado.id);
  }
  console.info(`[seed] ${environments.length} ambientes prontos`);

  for (const device of devices) {
    const environmentId = idPorSlug.get(ONDE_FICA[device.slug] ?? "") ?? null;
    await prisma.device.upsert({
      where: { slug: device.slug },
      update: { name: device.name, kind: device.kind, accent: device.accent, environmentId },
      create: { ...device, online: true, environmentId },
    });
  }
  console.info(`[seed] ${devices.length} dispositivos prontos`);

  const email = "admin@ecosense.local";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Administrador",
      passwordHash: await hashPassword("ecosense123"),
    },
  });
  console.info(`[seed] usuário ${email} / senha: ecosense123`);
}

try {
  await main();
} finally {
  await disconnectDatabase();
}
