import { deviceActions, useDevice } from "../store/useDevices";
import { api } from "../services/api";
import EventList from "../components/EventList";
import PageHeader from "../components/PageHeader";
import PowerButton from "../components/PowerButton";
import StatusPill from "../components/StatusPill";
import Switch from "../components/Switch";
import ThresholdSlider from "../components/ThresholdSlider";
import {
  IconBack,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconMenu,
  IconPower,
  IconVolumeDown,
  IconVolumeUp,
} from "../components/Icons";

const SOURCES = ["HDMI 1", "HDMI 2", "VGA"];

/** Cada tecla do remoto vira um comando IR via api.sendCommand. */
function sendIR(key, label) {
  api.sendCommand("projetor", { action: "ir", key });
  deviceActions.notify(`Enviado por IR: ${label}`);
}

export default function Projetor() {
  const device = useDevice("projetor");
  const { fonte, autoOff, autoOffMin } = device.reading;

  function handlePower() {
    deviceActions.toggleOn("projetor");
    deviceActions.notify(`Enviado por IR: ${device.on ? "Desligar" : "Ligar"}`);
  }

  function handleSource(source) {
    deviceActions.setReading("projetor", { fonte: source }, { silent: true });
    sendIR(`source:${source}`, source);
  }

  return (
    <>
      <PageHeader title="Projetor" subtitle="Controle por infravermelho e desligamento automático">
        <StatusPill on={device.on} online={device.online} />
      </PageHeader>

      <div className="stack">
        <div className="grid grid-2">
          <section className="card">
            <div style={{ marginBottom: 8 }}>
              <h2 className="card-title">Controle remoto</h2>
              <p className="card-hint">Cada tecla envia um comando IR para o projetor.</p>
            </div>

            <div className="remote">
              <div className="remote-sources" role="group" aria-label="Fonte de vídeo">
                {SOURCES.map((source) => (
                  <button
                    key={source}
                    type="button"
                    className="source-btn"
                    aria-pressed={fonte === source}
                    onClick={() => handleSource(source)}
                  >
                    {source}
                  </button>
                ))}
              </div>

              <div className="dpad">
                <span />
                <button
                  type="button"
                  className="dpad-btn"
                  aria-label="Cima"
                  onClick={() => sendIR("up", "Cima")}
                >
                  <IconChevronUp size={22} />
                </button>
                <span />
                <button
                  type="button"
                  className="dpad-btn"
                  aria-label="Esquerda"
                  onClick={() => sendIR("left", "Esquerda")}
                >
                  <IconChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  className="dpad-btn ok"
                  onClick={() => sendIR("ok", "OK")}
                >
                  OK
                </button>
                <button
                  type="button"
                  className="dpad-btn"
                  aria-label="Direita"
                  onClick={() => sendIR("right", "Direita")}
                >
                  <IconChevronRight size={22} />
                </button>
                <span />
                <button
                  type="button"
                  className="dpad-btn"
                  aria-label="Baixo"
                  onClick={() => sendIR("down", "Baixo")}
                >
                  <IconChevronDown size={22} />
                </button>
                <span />
              </div>

              <div className="remote-row">
                <button
                  type="button"
                  className={`remote-key${device.on ? " is-on" : ""}`}
                  aria-pressed={device.on}
                  onClick={handlePower}
                >
                  <IconPower size={16} />
                  Power
                </button>
                <button type="button" className="remote-key" onClick={() => sendIR("menu", "Menu")}>
                  <IconMenu size={16} />
                  Menu
                </button>
                <button type="button" className="remote-key" onClick={() => sendIR("back", "Voltar")}>
                  <IconBack size={16} />
                  Voltar
                </button>
              </div>

              <div className="remote-row">
                <button
                  type="button"
                  className="remote-key"
                  onClick={() => sendIR("vol-", "Volume −")}
                  aria-label="Diminuir volume"
                >
                  <IconVolumeDown size={16} />−
                </button>
                <button
                  type="button"
                  className="remote-key"
                  onClick={() => sendIR("vol+", "Volume +")}
                  aria-label="Aumentar volume"
                >
                  <IconVolumeUp size={16} />+
                </button>
              </div>
            </div>
          </section>

          <div className="stack">
            <section className="card">
              <h2 className="card-title">Energia</h2>
              <p className="card-hint">Fonte atual: {fonte}</p>
              <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
                <PowerButton
                  on={device.on}
                  name="o projetor"
                  disabled={!device.online}
                  onToggle={handlePower}
                />
              </div>
            </section>

            <section className="card">
              <div className="row-between" style={{ marginBottom: autoOff ? 18 : 0 }}>
                <div>
                  <h2 className="card-title">Desligamento automático</h2>
                  <p className="card-hint">Desliga sozinho quando a sala esvazia.</p>
                </div>
                <Switch
                  checked={autoOff}
                  label="Desligamento automático do projetor"
                  onChange={(value) => deviceActions.setReading("projetor", { autoOff: value })}
                />
              </div>

              {autoOff && (
                <ThresholdSlider
                  label="Após X min sem presença"
                  value={autoOffMin}
                  unit=" min"
                  min={1}
                  max={60}
                  onChange={(value) => deviceActions.setThreshold("projetor", value)}
                  scale={["1 min", "60 min"]}
                />
              )}
            </section>
          </div>
        </div>

        <EventList deviceId="projetor" title="Histórico do projetor" />
      </div>
    </>
  );
}
