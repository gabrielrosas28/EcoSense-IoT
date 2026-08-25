import { deviceActions, useDevice } from "../store/useDevices";
import EventList from "../components/EventList";
import ModeToggle from "../components/ModeToggle";
import PageHeader from "../components/PageHeader";
import PowerButton from "../components/PowerButton";
import StatusPill from "../components/StatusPill";
import ThresholdSlider from "../components/ThresholdSlider";
import { IconPresence } from "../components/Icons";

export default function Luz() {
  const device = useDevice("luz");
  const { presenca, sleepMin } = device.reading;

  return (
    <>
      <PageHeader title="Iluminação" subtitle="Controle por presença e desligamento automático">
        <StatusPill on={device.on} online={device.online} />
      </PageHeader>

      <div className="stack">
        <div className="grid grid-2">
          <section className="card">
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <div>
                <h2 className="card-title">Controle</h2>
                <p className="card-hint">
                  {device.mode === "auto"
                    ? "Em automático, a luz segue o sensor de presença."
                    : "Em manual, a luz responde apenas a você."}
                </p>
              </div>
              <ModeToggle mode={device.mode} onChange={(mode) => deviceActions.setMode("luz", mode)} />
            </div>

            <div
              className="row"
              style={{ justifyContent: "center", gap: 40, marginTop: 28, flexWrap: "wrap" }}
            >
              <PowerButton
                on={device.on}
                name="a iluminação"
                disabled={!device.online}
                onToggle={() => deviceActions.toggleOn("luz")}
              />

              <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
                <span
                  className="device-icon"
                  style={{ background: presenca ? device.accent : "var(--tint-gray)", color: presenca ? "var(--card)" : "var(--muted)" }}
                >
                  <IconPresence size={20} />
                </span>
                <p className="card-title">{presenca ? "Presença detectada" : "Sala vazia"}</p>
                <p className="card-hint">Sensor PIR da sala</p>
              </div>
            </div>
          </section>

          <section className="card">
            <div style={{ marginBottom: 18 }}>
              <h2 className="card-title">Desligamento automático</h2>
              <p className="card-hint">Tempo sem presença antes de apagar a luz.</p>
            </div>
            <ThresholdSlider
              label="Desligar após"
              value={sleepMin}
              unit=" min"
              min={1}
              max={60}
              onChange={(value) => deviceActions.setThreshold("luz", value)}
              scale={["1 min", "60 min"]}
            />
          </section>
        </div>

        <EventList deviceId="luz" title="Histórico da iluminação" />
      </div>
    </>
  );
}
