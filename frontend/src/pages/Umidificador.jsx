import { deviceActions, useDevice } from "../store/useDevices";
import EventList from "../components/EventList";
import Gauge from "../components/Gauge";
import ModeToggle from "../components/ModeToggle";
import PageHeader from "../components/PageHeader";
import PowerButton from "../components/PowerButton";
import StatusPill from "../components/StatusPill";
import ThresholdSlider from "../components/ThresholdSlider";

export default function Umidificador() {
  const device = useDevice("umidificador");
  const { air, threshold } = device.reading;
  const seco = air < threshold;

  return (
    <>
      <PageHeader title="Umidificador" subtitle="Umidade do ar e conforto da sala">
        <StatusPill on={device.on} online={device.online} />
      </PageHeader>

      <div className="stack">
        <div className="grid grid-2">
          <section className="card">
            <div className="row-between" style={{ alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 className="card-title">Umidade do ar</h2>
                <p className="card-hint">Leitura do sensor DHT da sala</p>
              </div>
              <ModeToggle
                mode={device.mode}
                onChange={(mode) => deviceActions.setMode("umidificador", mode)}
              />
            </div>

            <div className="row" style={{ justifyContent: "space-around", flexWrap: "wrap", gap: 28 }}>
              <Gauge
                value={air}
                accent={device.accent}
                label="ar"
                hint={
                  seco
                    ? `Abaixo do limite de ${threshold}% — umidificação recomendada.`
                    : `Acima do limite de ${threshold}% — ar confortável.`
                }
              />
              <PowerButton
                on={device.on}
                name="o umidificador"
                disabled={!device.online}
                onToggle={() => deviceActions.toggleOn("umidificador")}
              />
            </div>
          </section>

          <section className="card">
            <div style={{ marginBottom: 18 }}>
              <h2 className="card-title">Limite</h2>
              <p className="card-hint">Válido quando o modo automático está ativo.</p>
            </div>
            <ThresholdSlider
              label="Ligar quando ar <"
              value={threshold}
              min={20}
              max={95}
              onChange={(value) => deviceActions.setThreshold("umidificador", value)}
            />
          </section>
        </div>

        <EventList deviceId="umidificador" title="Histórico do umidificador" />
      </div>
    </>
  );
}
