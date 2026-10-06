import { create } from "zustand";
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from "../services/api";

const MOCK_FALLBACK = import.meta.env.VITE_AUTH_MOCK === "true";

export const useAuth = create((set, get) => ({
  user: null,
  token: null,
  status: "idle",
  error: null,

  signIn(email, password) {
    return startSession(() => api.login(email, password), { email, name: "Demonstração" });
  },

  signUp(name, email, password) {
    return startSession(() => api.register(name, email, password), { email, name });
  },

  signOut() {
    setAuthToken(null);
    set({ user: null, token: null, error: null });
  },

  clearError() {
    if (get().error) set({ error: null });
  },
}));

async function startSession(call, demoUser) {
  useAuth.setState({ status: "loading", error: null });
  try {
    const { token, user } = await call();
    setAuthToken(token);
    useAuth.setState({ user, token, status: "idle" });
    return true;
  } catch (err) {
    if (MOCK_FALLBACK && err instanceof ApiError && err.offline) {
      useAuth.setState({ user: { id: "demo", ...demoUser }, token: null, status: "idle" });
      return true;
    }
    useAuth.setState({ status: "idle", error: messageFor(err) });
    return false;
  }
}

setUnauthorizedHandler(() => {
  useAuth.getState().signOut();
  useAuth.setState({ error: "Sua sessão expirou. Entre novamente." });
});

function messageFor(err) {
  if (!(err instanceof ApiError)) return "Erro inesperado. Tente novamente.";
  if (err.offline) return "Servidor indisponível. Verifique se o backend está rodando.";
  if (err.status === 401) return "E-mail ou senha inválidos.";
  if (err.status === 400) return err.details?.[0]?.erro ?? err.message;
  if (err.status === 409) return "Este e-mail já está cadastrado. Entre com ele ou use outro.";
  return err.message;
}
