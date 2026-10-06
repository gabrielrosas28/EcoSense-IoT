-- Série temporal dos sensores, para os gráficos do painel.
--
-- `devices.reading` guarda só o valor mais recente; aqui fica cada amostra que
-- o dispositivo publicou em `ecosense/<id>/status`. Só entram os `sensors` do
-- catálogo (src/domain/devices.js): ajustes do painel (limites, fonte) não são
-- medição. Sensor booleano (`presenca`) é gravado como 0/1, o mesmo número que
-- as rotinas comparam.
CREATE TABLE readings (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id   text NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  sensor      text NOT NULL,
  value       double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- A consulta é sempre "um dispositivo, alguns sensores, um intervalo de tempo".
CREATE INDEX readings_device_sensor_recorded_at_idx ON readings (device_id, sensor, recorded_at DESC);
