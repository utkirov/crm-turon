import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '~~/server/database/schema'
import { createTables } from '~~/server/database/migrate'
import { seedDatabase } from '~~/server/database/seed'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDb() {
  if (_db) return _db
  const dbPath = process.env.DATABASE_PATH ?? 'crm.db'
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  _db = drizzle(sqlite, { schema })
  createTables(sqlite)
  seedDatabase(sqlite)
  return _db
}
