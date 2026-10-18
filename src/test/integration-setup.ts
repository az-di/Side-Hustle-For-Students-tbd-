import "dotenv/config";

// src/lib/env.ts validates on import; .env is enough for a local run.
if (!process.env.DATABASE_URL) {
  throw new Error("Integration tests need DATABASE_URL (copy .env.example to .env).");
}
