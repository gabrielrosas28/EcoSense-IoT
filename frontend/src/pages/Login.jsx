import { useState } from "react";
import { useAuth } from "../store/useAuth";
import { api } from "../services/api";
import { IconLeaf } from "../components/Icons";

export default function Login() {
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    // Com backend no ar, a resposta define a sessão; sem ele, entra direto (mock).
    await api.login(email, password);
    setBusy(false);
    signIn(email || "demo@ecosense.io");
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <IconLeaf size={26} />
          </span>
          <div>
            <h1 className="login-title">EcoSense IoT</h1>
            <p className="card-hint">Sala inteligente e sustentável</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="voce@ecosense.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="btn block" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="login-foot">Fase 1 — ambiente de demonstração</p>
      </div>
    </div>
  );
}
