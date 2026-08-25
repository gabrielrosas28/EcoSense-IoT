import { IconPower } from "./Icons";

export default function PowerButton({ on, onToggle, name, disabled = false, hint }) {
  return (
    <div className="row" style={{ flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        className={`power${on ? " on" : ""}`}
        aria-pressed={on}
        aria-label={`${on ? "Desligar" : "Ligar"} ${name}`}
        disabled={disabled}
        onClick={onToggle}
      >
        <IconPower size={40} />
      </button>
      <span className="power-label">{hint ?? (on ? "Ligado" : "Desligado")}</span>
    </div>
  );
}
