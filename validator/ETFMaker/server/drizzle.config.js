import { defineConfig } from "drizzle-kit";
import CONFIG from "../config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.js",
  out: "./drizzle",
  dbCredentials: {
    url: CONFIG.dbURL,
  },
});