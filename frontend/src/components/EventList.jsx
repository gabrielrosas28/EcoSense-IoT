import { useDevices } from "../store/useDevices";

/** Histórico de eventos. Vem do store (alimentado por ações e pelo WebSocket). */
export default function EventList({ deviceId, limit = 8, title = "Eventos recentes" }) {
  const events = useDevices((s) => s.events);
  const devices = useDevices((s) => s.devices);

  const filtered = (deviceId ? events.filter((e) => e.device === deviceId) : events).slice(0, limit);

  return (
    <section className="card">
      <div style={{ marginBottom: 12 }}>
        <h2 className="card-title">{title}</h2>
        <p className="card-hint">
          {deviceId ? "Deste dispositivo" : "De todos os subsistemas"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">Nenhum evento por enquanto.</p>
      ) : (
        <ul className="event-list">
          {filtered.map((event) => (
            <li key={event.id} className="event">
              <span
                className="event-bullet"
                style={{ background: devices[event.device]?.accent ?? "var(--muted)" }}
              />
              <div>
                <p className="event-text">{event.text}</p>
                <p className="event-time">{event.at}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
