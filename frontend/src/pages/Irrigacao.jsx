import { deviceActions, useDevice } from "../store/useDevices";
import EventList from "../components/EventList";
import Gauge from "../components/Gauge";
import ModeToggle from "../components/ModeToggle";
import PageHeader from "../components/PageHeader";
import PowerButton from "../components/PowerButton";
import StatusPill from "../components/StatusPill";
import ThresholdSlider from "../components/ThresholdSlider";

export default function Irrigacao() {
  const device = useDevice("irrigacao");
  const { soil, threshold, maxPumpSec } = device.reading;
  const seco = soil < threshold;

  return (
    <>
      <PageHeader title="Irrigação" subtitle="Umidade do solo e acionamento da bomba">
        <StatusPill on={device.on} online={device.online} labelOn="Bomba ligada" labelOff="Bomba parada" />
      </PageHeader>

      <div className="stack">
        <div className="grid grid-2">
          <section className="card">
            <div className="row-between" style={{ alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 className="card-title">Umidade do solo</h2>
                <p className="card-hint">Leitura do sensor capacitivo</p>
              </div>
              <ModeToggle
                mode={device.mode}
                onChange={(mode) => deviceActions.setMode("irrigacao", mode)}
              />
            </div>

            <div className="row" style={{ justifyContent: "space-around", flexWrap: "wrap", gap: 28 }}>
              <Gauge
                value={soil}
                accent={device.accent}
                label="solo"
                hint={
                  seco
                    ? `Abaixo do limite de ${threshold}% — irrigação necessária.`
                    : `Acima do limite de ${threshold}% — solo úmido.`
                }
              />
              <PowerButton
                on={device.on}
                name="a bomba"
                disabled={!device.online}
                hint={device.on ? "Bomba ligada" : "Bomba parada"}
                onToggle={() => deviceActions.toggleOn("irrigacao")}
              />
            </div>
          </section>

          <section className="card stack">
            <div>
              <h2 className="card-title">Limites</h2>
              <p className="card-hint">Válidos quando o modo automático está ativo.</p>
            </div>

            <ThresholdSlider
              label="Irrigar quando solo <"
              value={threshold}
              min={5}
              max={90}
              onChange={(value) => deviceActions.setThreshold("irrigacao", value)}
            />

            <ThresholdSlider
              label="Tempo máximo da bomba"
              value={maxPumpSec}
              unit=" s"
              min={1}
              max={60}
              onChange={(value) => deviceActions.setReading("irrigacao", { maxPumpSec: value })}
              scale={["1 s", "60 s"]}
            />
          </section>
        </div>

        <EventList deviceId="irrigacao" title="Histórico da irrigação" />
      </div>
    </>
  );
}
