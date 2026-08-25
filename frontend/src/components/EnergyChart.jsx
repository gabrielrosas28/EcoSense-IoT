import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Dados de exemplo do protótipo — substituídos pelo backend quando existir. */
const SAMPLE = [
  { dia: "Seg", consumo: 4.2, economia: 1.1 },
  { dia: "Ter", consumo: 3.8, economia: 1.6 },
  { dia: "Qua", consumo: 4.0, economia: 1.4 },
  { dia: "Qui", consumo: 3.2, economia: 2.2 },
  { dia: "Sex", consumo: 2.9, economia: 2.5 },
  { dia: "Sáb", consumo: 1.8, economia: 3.1 },
  { dia: "Dom", consumo: 1.5, economia: 3.4 },
];

export default function EnergyChart({ data = SAMPLE }) {
  const total = data.reduce((sum, d) => sum + d.economia, 0);

  return (
    <section className="card">
      <div className="row-between" style={{ marginBottom: 18 }}>
        <div>
          <h2 className="card-title">Economia de energia</h2>
          <p className="card-hint">Últimos 7 dias, em kWh</p>
        </div>
        <span className="pill on">{total.toFixed(1)} kWh economizados</span>
      </div>

      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-economia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green-bright)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--green-bright)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-consumo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="dia"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-2)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              width={44}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
                fontSize: 13,
              }}
              formatter={(value, name) => [`${value} kWh`, name === "economia" ? "Economia" : "Consumo"]}
            />
            <Area
              type="monotone"
              dataKey="consumo"
              stroke="var(--amber)"
              strokeWidth={2}
              fill="url(#grad-consumo)"
            />
            <Area
              type="monotone"
              dataKey="economia"
              stroke="var(--green-bright)"
              strokeWidth={2.5}
              fill="url(#grad-economia)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
