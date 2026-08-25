/** Medidor circular (umidade do solo / do ar). */
export default function Gauge({
  value,
  unit = "%",
  accent = "var(--green)",
  size = 148,
  label,
  hint,
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="gauge">
      <div className="gauge-figure" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`${label ?? "Leitura"}: ${clamped}${unit}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--tint-gray)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset .4s ease" }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-value">
            {clamped}
            <span style={{ fontSize: 16 }}>{unit}</span>
          </span>
          {label && <span className="gauge-unit">{label}</span>}
        </div>
      </div>
      {hint && (
        <p className="card-hint" style={{ maxWidth: 220 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
