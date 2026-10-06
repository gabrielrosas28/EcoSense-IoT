export const DEVICE_SLUGS = ["luz", "projetor", "irrigacao", "umidificador"] as const;
export type DeviceSlug = (typeof DEVICE_SLUGS)[number];

export const TOPIC = {
  command: (slug: string) => `ecosense/${slug}/cmd`,
  status: (slug: string) => `ecosense/${slug}/status`,
};

export type Mode = "auto" | "manual";

export interface DeviceCommand {
  action: string;
  key?: string;
  value?: string | number | boolean;
  [extra: string]: unknown;
}

export interface DeviceStatus {
  on: boolean;
  mode: Mode;
  online: boolean;
  [reading: string]: unknown;
}

export function isDeviceSlug(value: string): value is DeviceSlug {
  return (DEVICE_SLUGS as readonly string[]).includes(value);
}
