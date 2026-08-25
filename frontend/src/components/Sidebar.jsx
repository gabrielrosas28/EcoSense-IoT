import { NavLink } from "react-router-dom";
import { useDeviceList } from "../store/useDevices";
import { useAuth } from "../store/useAuth";
import { IconGrid, IconLeaf, IconLogout, IconRoutines } from "./Icons";
import { DEVICE_ICON } from "./deviceIcons";

/**
 * O ponto de status de cada item vem do store — por isso ele muda
 * junto com a tela de detalhe e com o card do Dashboard, sem código extra.
 */
function StatusDot({ on, online }) {
  const cls = !online ? "status-dot offline" : on ? "status-dot on" : "status-dot";
  const label = !online ? "offline" : on ? "ligado" : "desligado";
  return (
    <span className={cls} role="img" aria-label={label} title={label} />
  );
}

export default function Sidebar() {
  const devices = useDeviceList();
  const signOut = useAuth((s) => s.signOut);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <IconLeaf size={20} />
        </span>
        <span>
          <span className="brand-name">EcoSense</span>
          <span className="brand-tag" style={{ display: "block" }}>
            IoT
          </span>
        </span>
      </div>

      <nav className="nav" aria-label="Navegação principal">
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <span className="accent-chip" style={{ background: "var(--green-bright)" }} />
          <IconGrid size={18} />
          <span className="nav-item-text">Dashboard</span>
        </NavLink>

        <span className="nav-label">Dispositivos</span>

        {devices.map((device) => {
          const Icon = DEVICE_ICON[device.id];
          return (
            <NavLink
              key={device.id}
              to={device.path}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="accent-chip" style={{ background: device.accent }} />
              {Icon && <Icon size={18} />}
              <span className="nav-item-text">{device.name}</span>
              <StatusDot on={device.on} online={device.online} />
            </NavLink>
          );
        })}

        <span className="nav-label">Automação</span>

        <NavLink to="/rotinas" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <span className="accent-chip" style={{ background: "var(--green)" }} />
          <IconRoutines size={18} />
          <span className="nav-item-text">Rotinas</span>
        </NavLink>
      </nav>

      <div className="sidebar-foot">
        <button type="button" className="logout" onClick={signOut}>
          <IconLogout size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
