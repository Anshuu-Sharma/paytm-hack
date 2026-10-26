/**
 * Base URL for the REX FastAPI backend. Overridable at build time via
 * NEXT_PUBLIC_API_BASE; defaults to the local dev server.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
