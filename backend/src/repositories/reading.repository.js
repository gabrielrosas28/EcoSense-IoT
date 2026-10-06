import { pool } from "../database/pool.js";

export async function createMany(deviceId, values, db = pool) {
  const sensors = Object.keys(values);
  if (sensors.length === 0) return;
  await db.query(
    `INSERT INTO readings (device_id, sensor, value)
     SELECT $1, sensor, value FROM unnest($2::text[], $3::float8[]) AS t (sensor, value)`,
    [deviceId, sensors, Object.values(values)],
  );
}

export async function findRaw({ deviceId, sensors, from, to, limit }, db = pool) {
  const { rows } = await db.query(
    `SELECT sensor, recorded_at, value
       FROM (SELECT sensor, recorded_at, value,
                    row_number() OVER (PARTITION BY sensor ORDER BY recorded_at DESC, id DESC) AS n
               FROM readings
              WHERE device_id = $1 AND sensor = ANY ($2) AND recorded_at BETWEEN $3 AND $4) AS t
      WHERE n <= $5
      ORDER BY sensor, recorded_at`,
    [deviceId, sensors, from, to, limit],
  );
  return rows.map((row) => ({ sensor: row.sensor, at: row.recorded_at, value: row.value }));
}

export async function findBuckets({ deviceId, sensors, from, to, limit, interval, timezone }, db = pool) {
  const { rows } = await db.query(
    `WITH buckets AS (
       SELECT sensor,
              CASE WHEN $6::interval = interval '1 day' THEN date_trunc('day', recorded_at, $7)
                   ELSE date_bin($6::interval, recorded_at, timestamptz '2000-01-01T00:00:00Z') END AS bucket,
              avg(value) AS avg, min(value) AS min, max(value) AS max, count(*)::int AS count
         FROM readings
        WHERE device_id = $1 AND sensor = ANY ($2) AND recorded_at BETWEEN $3 AND $4
        GROUP BY 1, 2
     ), ranked AS (
       SELECT *, row_number() OVER (PARTITION BY sensor ORDER BY bucket DESC) AS n FROM buckets
     )
     SELECT sensor, bucket, avg, min, max, count
       FROM ranked
      WHERE n <= $5
      ORDER BY sensor, bucket`,
    [deviceId, sensors, from, to, limit, interval, timezone],
  );
  return rows.map((row) => ({
    sensor: row.sensor,
    at: row.bucket,
    avg: row.avg,
    min: row.min,
    max: row.max,
    count: row.count,
  }));
}
