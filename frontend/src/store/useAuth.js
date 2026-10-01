import { create } from "zustand";
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from "../services/api";

/**
 * Sessão em memória — sem localStorage/sessionStorage (regra do CLAUDE.md).
 * Recarregar a página volta ao login.
 *
 * Com VITE_AUTH_MOCK=true, se o backend estiver fora do ar o login entra
 * como usuário de demonstração (Fase 1, sem API).
 */
const MOCK_FALLBACK = import.meta.env.VITE_AUTH_MOCK === "true";

export const useAuth = create((set, get) => ({
  user: null,
  token: null,
  status: "idle", // idle | loading
  error: null,

  async signIn(email, password) {
    set({ status: "loading", error: null });
    try {
      const { token, user } = await api.login(email, password);
      setAuthToken(token);
      set({ user, token, status: "idle" });
      return true;
    } catch (err) {
      if (MOCK_FALLBACK && err instanceof ApiError && err.offline) {
        set({ user: { id: "demo", email, name: "Demonstração" }, token: null, status: "idle" });
        return true;
      }
      set({ status: "idle", error: messageFor(err) });
      return false;
    }
  },

  signOut() {
    setAuthToken(null);
    set({ user: null, token: null, error: null });
  },

  clearError() {
    if (get().error) set({ error: null });
  },
}));

// Token expirado em qualquer chamada autenticada derruba a sessão.
setUnauthorizedHandler(() => {
  useAuth.getState().signOut();
  useAuth.setState({ error: "Sua sessão expirou. Entre novamente." });
});

function messageFor(err) {
  if (!(err instanceof ApiError)) return "Erro inesperado. Tente novamente.";
  if (err.offline) return "Servidor indisponível. Verifique se o backend está rodando.";
  if (err.status === 401) return "E-mail ou senha inválidos.";
  if (err.status === 400) return err.details?.[0]?.erro ?? err.message;
  return err.message;
}
