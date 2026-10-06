CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE devices (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  accent       text NOT NULL,
  position     smallint NOT NULL DEFAULT 0,
  is_on        boolean NOT NULL DEFAULT false,
  mode         text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
  online       boolean NOT NULL DEFAULT false,
  reading      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(reading) = 'object'),
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
