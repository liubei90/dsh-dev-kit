// Explicit migration run, invoked via `pnpm migrate` in apps/api.

import { loadConfig } from '../config.js'
import { openDatabase, runMigrations } from './database.js'

const config = loadConfig()
const db = openDatabase(config.databasePath)
const applied = runMigrations(db)
console.log(applied.length > 0 ? `applied: ${applied.join(', ')}` : 'no pending migrations')
db.close()
