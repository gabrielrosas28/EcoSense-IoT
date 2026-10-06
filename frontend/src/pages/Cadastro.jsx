import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/useAuth";
import { IconLeaf } from "../components/Icons";
import { onlyErrors, validateEmail, validateName, validatePassword } from "../services/validation";

function validate({ name, email, password, confirm }) {
  return onlyErrors({
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
    confirm: password && confirm !== password ? "As senhas não conferem." : undefined,
  });
}

const EMPTY = { name: "", email: "", password: "", confirm: "" };

export default function Cadastro() {
  const signUp = useAuth((s) => s.signUp);
  const busy = useAuth((s) => s.status === "loading");
  const serverError = useAuth((s) => s.error);
  const clearError = useAuth((s) => s.clearError);
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const ok = await signUp(form.name.trim(), form.email.trim(), form.password);
    if (ok) {
      const from = location.state?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } else {
      setForm((prev) => ({ ...prev, password: "", confirm: "" }));
    }
  }

  function onChange(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      clearError();
    };
  }

  /** Props comuns de cada campo, com o erro ligado por aria-describedby. */
  function fieldProps(field) {
    return {
      name: field,
      value: form[field],
      onChange: onChange(field),
      "aria-invalid": Boolean(fieldErrors[field]),
      "aria-describedby": fieldErrors[field] ? `${field}-erro` : undefined,
      disabled: busy,
    };
  }

  function fieldError(field) {
    return (
      fieldErrors[field] && (
        <small id={`${field}-erro`} className="field-error">
          {fieldErrors[field]}
        </small>
      )
    );
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <IconLeaf size={26} />
          </span>
          <div>
            <h1 className="login-title">Criar conta</h1>
            <p className="card-hint">EcoSense IoT — sala inteligente e sustentável</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {serverError && (
            <p className="form-alert" role="alert">
              {serverError}
            </p>
          )}

          <label className="field">
            <span>Nome</span>
            <input type="text" autoComplete="name" placeholder="Seu nome" autoFocus {...fieldProps("name")} />
            {fieldError("name")}
          </label>

          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" placeholder="voce@ecosense.io" {...fieldProps("email")} />
            {fieldError("email")}
          </label>

          <label className="field">
            <span>Senha</span>
            <input type="password" autoComplete="new-password" placeholder="Ao menos 6 caracteres" {...fieldProps("password")} />
            {fieldError("password")}
          </label>

          <label className="field">
            <span>Confirme a senha</span>
            <input type="password" autoComplete="new-password" placeholder="••••••••" {...fieldProps("confirm")} />
            {fieldError("confirm")}
          </label>

          <button type="submit" className="btn block" disabled={busy} aria-busy={busy}>
            {busy ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="login-switch">
          Já tem conta?{" "}
          <Link to="/login" state={location.state} onClick={clearError}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
