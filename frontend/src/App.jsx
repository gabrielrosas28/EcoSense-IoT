import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./store/useAuth";
import { startRealtime } from "./services/realtime";
import Sidebar from "./components/Sidebar";
import Toasts from "./components/Toasts";
import Dashboard from "./pages/Dashboard";
import Irrigacao from "./pages/Irrigacao";
import Login from "./pages/Login";
import Luz from "./pages/Luz";
import Projetor from "./pages/Projetor";
import Rotinas from "./pages/Rotinas";
import Umidificador from "./pages/Umidificador";

/** Layout do app: Sidebar fixa + conteúdo da rota. */
function AppLayout() {
  const user = useAuth((s) => s.user);
  const location = useLocation();

  // WebSocket ligado enquanto houver sessão.
  useEffect(() => {
    if (!user) return undefined;
    return startRealtime();
  }, [user]);

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}

function LoginRoute() {
  const user = useAuth((s) => s.user);
  return user ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="luz" element={<Luz />} />
        <Route path="projetor" element={<Projetor />} />
        <Route path="irrigacao" element={<Irrigacao />} />
        <Route path="umidificador" element={<Umidificador />} />
        <Route path="rotinas" element={<Rotinas />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
