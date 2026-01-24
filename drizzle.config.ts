import "dotenv/config";
import type { Config } from "drizzle-kit";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL is missing");

const u = new URL(raw);

const host = u.hostname;
const port = u.port ? Number(u.port) : 3306;
const user = decodeURIComponent(u.username);
const password = decodeURIComponent(u.password);
const database = u.pathname.replace(/^\//, "");

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: true },
  },
} satisfies Config;
