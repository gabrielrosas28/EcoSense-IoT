/**
 * Campos que os middlewares acrescentam à request.
 * `requireAuth` popula `user`; `validate` guarda a query já convertida
 * (no Express 5 `req.query` é getter-only).
 */
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
