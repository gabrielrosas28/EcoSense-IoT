import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/useAuth";
import { IconLeaf } from "../components/Icons";
import { onlyErrors, validateEmail, validatePassword } from "../services/validation";

function validate(email, password) {
  return onlyErrors({ email: validateEmail(email), password: validatePassword(password) });
}

export default function Login() {
  const signIn = useAuth((s) => s.signIn);
  const busy = useAuth((s) => s.status === "loading");
  const serverError = useAuth((s) => s.error);
  const clearError = useAuth((s) => s.clearError);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const ok = await signIn(email.trim(), password);
    if (ok) {
      // Volta para onde o usuário tentou ir antes de cair no login.
      const from = location.state?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } else {
      setPassword("");
    }
  }

  function onChange(setter, field) {
    return (e) => {
      setter(e.target.value);
      if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      clearError();
    };
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

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {serverError && (
            <p className="form-alert" role="alert">
              {serverError}
            </p>
          )}

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="voce@ecosense.io"
              value={email}
              onChange={onChange(setEmail, "email")}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-erro" : undefined}
              disabled={busy}
              autoFocus
            />
            {fieldErrors.email && (
              <small id="email-erro" className="field-error">
                {fieldErrors.email}
              </small>
            )}
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={onChange(setPassword, "password")}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "senha-erro" : undefined}
              disabled={busy}
            />
            {fieldErrors.password && (
              <small id="senha-erro" className="field-error">
                {fieldErrors.password}
              </small>
            )}
          </label>

          <button type="submit" className="btn block" disabled={busy} aria-busy={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="login-switch">
          Ainda não tem conta?{" "}
          <Link to="/cadastro" state={location.state} onClick={clearError}>
            Criar conta
          </Link>
        </p>

        <p className="login-foot">Fase 1 — ambiente de demonstração</p>
      </div>
    </div>
  );
}
