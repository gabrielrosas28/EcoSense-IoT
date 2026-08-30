/**
 * Contrato da API — o mesmo shape que o store do frontend consome
 * (`frontend/src/store/useDevices.js`). Se mudar aqui, mude lá.
 */

/** Ids dos 4 subsistemas. São também os slugs das rotas e dos tópicos MQTT. */
export const DEVICE_SLUGS = ["luz", "projetor", "irrigacao", "umidificador"] as const;
export type DeviceSlug = (typeof DEVICE_SLUGS)[number];

export type DeviceModeDTO = "auto" | "manual";

/** Leitura/configuração corrente. Formato livre por dispositivo. */
export type DeviceReading = Record<string, unknown>;

/** Ambiente resumido, como aparece dentro de um dispositivo. */
export interface EnvironmentRefDTO {
  id: string;
  name: string;
}

export interface EnvironmentDTO extends EnvironmentRefDTO {
  description: string | null;
  location: string | null;
}

export interface DeviceDTO {
  id: DeviceSlug | string;
  name: string;
  accent: string;
  on: boolean;
  mode: DeviceModeDTO;
  online: boolean;
  reading: DeviceReading;
  lastSeen: Date | null;
  /** Onde o dispositivo está instalado. `null` enquanto ninguém definiu. */
  environment: EnvironmentRefDTO | null;
}

/** Uma medição da série temporal. */
export interface ReadingDTO {
  id: string;
  device: string;
  metric: string;
  value: number;
  unit: string | null;
  at: Date;
}

export interface EventDTO {
  id: string;
  device: string | null;
  text: string;
  at: Date;
  source: string;
}

export interface RoutineDTO {
  id: string;
  name: string;
  enabled: boolean;
  if: { sensor: string; operator: string; value: number };
  then: { action: string; device: string };
  createdAt: Date;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
}

/** Comando vindo do painel (`api.sendCommand` no frontend). */
export interface DeviceCommand {
  action: string;
  key?: string;
  value?: string | number | boolean;
  [extra: string]: unknown;
}

/** Estado reportado pelo dispositivo (`ecosense/<slug>/status`). */
export interface DeviceStatus {
  on?: boolean;
  mode?: DeviceModeDTO;
  online?: boolean;
  [reading: string]: unknown;
}
