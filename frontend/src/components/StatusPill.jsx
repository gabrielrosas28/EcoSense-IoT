export default function StatusPill({ on, online = true, labelOn = "Ligado", labelOff = "Desligado" }) {
  if (!online) {
    return (
      <span className="pill offline">
        <span className="pill-dot" />
        Offline
      </span>
    );
  }
  return (
    <span className={`pill${on ? " on" : ""}`}>
      <span className="pill-dot" />
      {on ? labelOn : labelOff}
    </span>
  );
}
