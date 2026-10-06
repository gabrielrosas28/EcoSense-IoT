import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";
import { useDevices } from "../store/useDevices";

/** Períodos do seletor. O intervalo mantém o gráfico entre ~70 e ~170 pontos. */
const PERIODS = [
  { id: "6h", label: "6 h", hours: 6, interval: "5m" },
  { id: "24h", label: "24 h", hours: 24, interval: "15m" },
  { id: "7d", label: "7 dias", hours: 24 * 7, interval: "1h" },
];

const REFRESH_MS = 60_000;

const keyOf = (s) => `${s.deviceId}_${s.sensor}`;

/**
 * Histórico de umidade (RF08), vindo de `GET /api/devices/:id/readings`.
 *
 * `series`: `[{ deviceId, sensor, label, color, threshold? }]`. Com várias
 * séries, os pontos se alinham porque a API agrega todas na mesma janela. O
 * limite vira uma linha tracejada na cor da série. Sem backend (Fase 1), mostra
 * uma curva de exemplo que termina na leitura atual do store, com aviso na tela.
 */
export default function HumidityChart({ title, hint, series }) {
  const [periodId, setPeriodId] = useState("24h");
  const [data, setData] = useState({ status: "loading", points: [] });
  const period = PERIODS.find((p) => p.id === periodId);

  // `series` muda de identidade a cada render (o limite vem do store); a busca
  // só depende de quais sensores são, então a chave é a lista deles.
  const sensorsKey = series.map(keyOf).join(",");

  useEffect(() => {
    const wanted = sensorsKey.split(",").map((key) => {
      const [deviceId, sensor] = key.split("_");
      return { deviceId, sensor };
    });
    let alive = true;

    async function load() {
      const to = new Date();
      const from = new Date(to.getTime() - period.hours * 3_600_000);
      const responses = await Promise.all(
        wanted.map((s) =>
          api.getReadings(s.deviceId, {
            sensor: s.sensor,
            from: from.toISOString(),
            to: to.toISOString(),
            interval: period.interval,
            limit: 1000,
          }),
        ),
      );
      if (!alive) return;

      if (responses.every((r) => r === null)) {
        setData({ status: "sample", points: samplePoints(wanted, period) });
      } else {
        setData({ status: "ok", points: mergeSeries(wanted, responses) });
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sensorsKey, period]);

  const formatTick = useMemo(() => tickFormatter(period), [period]);
  const empty = data.status === "ok" && data.points.length === 0;

  return (
    <section className="card">
      <div className="row-between" style={{ alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="card-hint">
            {data.status === "sample" ? "Dados de exemplo — servidor indisponível" : hint}
          </p>
        </div>
        <div className="segmented compact" role="group" aria-label="Período do gráfico">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={p.id === periodId} onClick={() => setPeriodId(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", height: 240 }} aria-busy={data.status === "loading"}>
        {empty ? (
          <p className="empty">Nenhuma leitura neste período.</p>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="at"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatTick}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tick={{ fill: "var(--text-2)", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                unit="%"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                width={46}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow)",
                  fontSize: 13,
                }}
                labelFormatter={(at) => fullFormat.format(at)}
                formatter={(value, key) => {
                  const s = series.find((item) => keyOf(item) === key);
                  return [`${Number(value).toFixed(1)}%`, s?.label ?? key];
                }}
              />
              {series
                .filter((s) => s.threshold != null)
                .map((s) => (
                  <ReferenceLine
                    key={`limite-${keyOf(s)}`}
                    y={s.threshold}
                    stroke={s.color}
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    label={{
                      value: `limite ${s.threshold}%`,
                      position: "insideTopRight",
                      fill: "var(--muted)",
                      fontSize: 11,
                    }}
                  />
                ))}
              {series.map((s) => (
                <Line
                  key={keyOf(s)}
                  type="monotone"
                  dataKey={keyOf(s)}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={keyOf(s)}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** Junta as séries num ponto por instante: `{ at, irrigacao_soil, umidificador_air }`. */
function mergeSeries(wanted, responses) {
  const byTime = new Map();
  wanted.forEach((s, i) => {
    for (const point of responses[i]?.series?.[s.sensor] ?? []) {
      const at = new Date(point.at).getTime();
      const row = byTime.get(at) ?? { at };
      row[keyOf(s)] = point.value;
      byTime.set(at, row);
    }
  });
  return [...byTime.values()].sort((a, b) => a.at - b.at);
}

/** Curva de exemplo determinística, terminando na leitura atual do store. */
function samplePoints(wanted, period) {
  const devices = useDevices.getState().devices;
  const steps = 48;
  const stepMs = (period.hours * 3_600_000) / steps;
  const end = Date.now();
  return Array.from({ length: steps + 1 }, (_, i) => {
    const row = { at: end - (steps - i) * stepMs };
    wanted.forEach((s, j) => {
      const current = Number(devices[s.deviceId]?.reading?.[s.sensor] ?? 50);
      const wave = Math.sin((i + j * 7) / 5) * 6 + Math.sin((i + j * 3) / 2.3) * 2;
      const fade = (steps - i) / steps; // converge para a leitura atual no fim
      row[keyOf(s)] = Math.max(0, Math.min(100, current + wave * fade));
    });
    return row;
  });
}

function tickFormatter(period) {
  const fmt =
    period.hours > 24
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
      : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (at) => fmt.format(at);
}

const fullFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
