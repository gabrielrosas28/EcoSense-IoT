import { DEVICE_ORDER, useDeviceList } from "../store/useDevices";
import DeviceCard from "../components/DeviceCard";
import EnergyChart from "../components/EnergyChart";
import EventList from "../components/EventList";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";

export default function Dashboard() {
  const devices = useDeviceList();
  const ativos = devices.filter((d) => d.on).length;
  const offline = devices.filter((d) => !d.online).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${ativos} de ${devices.length} dispositivos ligados`}
      >
        <StatusPill
          on={ativos > 0}
          online={offline === 0}
          labelOn="Sistema ativo"
          labelOff="Tudo desligado"
        />
      </PageHeader>

      <div className="stack">
        <div className="grid grid-devices">
          {DEVICE_ORDER.map((id) => (
            <DeviceCard key={id} id={id} />
          ))}
        </div>

        <div className="grid grid-2">
          <EnergyChart />
          <EventList />
        </div>
      </div>
    </>
  );
}
