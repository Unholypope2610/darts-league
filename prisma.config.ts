import { defineConfig } from "prisma/config"
import { readFileSync } from "fs"
import { resolve } from "path"

// Prisma doesn't auto-load .env before reading this config, so we do it manually
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env")
    const contents = readFileSync(envPath, "utf-8")
    for (const line of contents.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const val = trimmed.slice(eqIndex + 1).trim().replace(/^"|"$/g, "")
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env not found — rely on process.env being set externally
  }
}

loadEnv()

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL!,
  },
})
