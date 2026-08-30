import type {
  Device,
  Environment,
  Routine,
  User,
} from "../../generated/prisma/client.ts";

/**
 * Linhas de banco de mentira. Os valores batem com o seed e com o mock do
 * frontend, então o que os testes afirmam é o que a UI realmente recebe.
 */

export const ENV_ID = "44444444-4444-4444-8444-444444444444";

export const environmentRow = (over: Partial<Environment> = {}): Environment => ({
  id: ENV_ID,
  slug: "sala-101",
  name: "Sala 101",
  description: "Sala de aula do bloco A",
  location: "Bloco A - 2o andar",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

export const deviceRow = (over: Partial<Device> = {}): Device => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "irrigacao",
  name: "Irrigação",
  kind: "IRRIGATION",
  accent: "var(--leaf)",
  isOn: false,
  mode: "AUTO",
  online: true,
  settings: { soil: 45, threshold: 30, maxPumpSec: 10 },
  lastSeen: null,
  environmentId: ENV_ID,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

export const routineRow = (
  over: Partial<Routine> = {},
): Routine & { device: { slug: string } } => ({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Se soil < 30 então ligar Irrigação",
  enabled: true,
  sensor: "soil",
  operator: "<",
  value: 30,
  action: "ligar",
  deviceId: "11111111-1111-4111-8111-111111111111",
  ownerId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
  device: { slug: "irrigacao" },
});

export const userRow = (over: Partial<User> = {}): User => ({
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin@ecosense.local",
  name: "Administrador",
  // hash de "ecosense123"
  passwordHash: "$2b$10$7/xWwlk5NSkkl5P9vCJatOJa/yN1J16qtYe0L.Yf/uXS5wTCfEi2W",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});
