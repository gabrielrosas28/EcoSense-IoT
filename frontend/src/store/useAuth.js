import { create } from "zustand";

/**
 * Sessão em memória — sem localStorage/sessionStorage (regra do CLAUDE.md).
 * Recarregar a página volta ao login; com backend, trocar por sessão do servidor.
 */
export const useAuth = create((set) => ({
  user: null,
  signIn(email) {
    set({ user: { email } });
  },
  signOut() {
    set({ user: null });
  },
}));
