import { Link } from "react-router-dom";
import { useDevice, deviceActions } from "../store/useDevices";
import { DEVICE_ICON } from "./deviceIcons";
import StatusPill from "./StatusPill";
import Switch from "./Switch";

/** Resumo curto da leitura de cada subsistema. */
function summary(device) {
  const r = device.reading;
  switch (device.id) {
    case "luz":
      return {
        metric: r.presenca ? "Presença" : "Vazio",
        unit: "",
        hint: `Desliga após ${r.sleepMin} min sem presença`,
      };
    case "projetor":
      return {
        metric: r.fonte,
        unit: "",
        hint: r.autoOff ? `Desligamento automático em ${r.autoOffMin} min` : "Desligamento automático off",
      };
    case "irrigacao":
      return { metric: r.soil, unit: "%", hint: `Irriga quando solo < ${r.threshold}%` };
    case "umidificador":
      return { metric: r.air, unit: "%", hint: `Liga quando ar < ${r.threshold}%` };
    default:
      return { metric: "—", unit: "", hint: "" };
  }
}

/**
 * Card do Dashboard. Lê o dispositivo do store, então o status muda
 * junto com o menu lateral e a tela de detalhe.
 */
export default function DeviceCard({ id }) {
  const device = useDevice(id);
  if (!device) return null;

  const Icon = DEVICE_ICON[id];
  const { metric, unit, hint } = summary(device);

  return (
    <article className="card device-card">
      <div className="device-card-head">
        <span className="device-icon" style={{ background: device.accent }}>
          {Icon && <Icon size={20} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={device.path} className="device-name">
            {device.name}
          </Link>
          <p className="device-reading">
            {device.mode === "auto" ? "Automático" : "Manual"}
          </p>
        </div>
        <Switch
          checked={device.on}
          disabled={!device.online}
          label={`${device.on ? "Desligar" : "Ligar"} ${device.name}`}
          onChange={(value) => deviceActions.setOn(id, value)}
        />
      </div>

      <div>
        <p className="device-metric">
          {metric}
          {unit && <small>{unit}</small>}
        </p>
        <p className="device-reading">{hint}</p>
      </div>

      <div className="row-between">
        <StatusPill on={device.on} online={device.online} />
        <Link to={device.path} className="card-hint" style={{ fontWeight: 500, color: "var(--green)" }}>
          Detalhes →
        </Link>
      </div>
    </article>
  );
}
