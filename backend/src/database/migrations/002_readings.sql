CREATE TABLE readings (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id   text NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  sensor      text NOT NULL,
  value       double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX readings_device_sensor_recorded_at_idx ON readings (device_id, sensor, recorded_at DESC);
