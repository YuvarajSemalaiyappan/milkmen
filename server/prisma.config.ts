import path from 'node:path'
import { defineConfig } from 'prisma/config'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async datasourceUrl() {
      return process.env.DATABASE_URL!
    },
  },
})
