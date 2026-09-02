// API service entry. Loads env-driven config, builds the server, and starts
// listening; the server factory lives in server.ts so tests can inject config.

import { loadConfig } from './config.js'
import { createServer } from './server.js'

const config = loadConfig()
const app = await createServer(config)
await app.listen({ port: config.port, host: '0.0.0.0' })
