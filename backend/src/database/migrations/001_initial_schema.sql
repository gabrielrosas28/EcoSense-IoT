-- Esquema inicial do EcoSense IoT.
--
-- Os ids dos dispositivos são os mesmos do frontend (store/useDevices.js) e
-- dos tópicos MQTT (ecosense/<id>/...), por isso viram a própria chave primária.

-- Mantém updated_at em dia em todo UPDATE, sem depender de quem escreve a query.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Quem acessa o painel. A senha fica só como hash (ver src/lib/password.js).
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- E-mail único, sem diferenciar maiúsculas de minúsculas.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Os subsistemas da sala e o estado corrente de cada um.
CREATE TABLE devices (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  accent       text NOT NULL,
  -- ordem de exibição no menu lateral e no dashboard
  position     smallint NOT NULL DEFAULT 0,
  is_on        boolean NOT NULL DEFAULT false,
  mode         text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
  online       boolean NOT NULL DEFAULT false,
  -- leituras e ajustes correntes, no mesmo formato do `reading` do frontend
  reading      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(reading) = 'object'),
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Regras "SE <sensor> <operador> <valor> ENTÃO <ação> <dispositivo>".
-- O id vem do cliente quando ele já tem um (o frontend cria a rotina na tela
-- e só depois sincroniza) ou é gerado pela API.
CREATE TABLE routines (
  id         text PRIMARY KEY,
  sensor     text NOT NULL,
  operator   text NOT NULL CHECK (operator IN ('lt', 'gt', 'eq')),
  value      double precision NOT NULL,
  action     text NOT NULL CHECK (action IN ('on', 'off')),
  device_id  text NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX routines_device_id_idx ON routines (device_id);

CREATE TRIGGER routines_set_updated_at BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Histórico legível exibido no EventList do dashboard.
CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id  text REFERENCES devices (id) ON DELETE SET NULL,
  message    text NOT NULL,
  source     text NOT NULL DEFAULT 'system'
             CHECK (source IN ('user', 'device', 'routine', 'system')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_created_at_idx ON events (created_at DESC);
CREATE INDEX events_device_id_created_at_idx ON events (device_id, created_at DESC);
