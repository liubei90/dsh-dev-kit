// Web app entry: mounts the React tree into #root from index.html.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('missing #root element in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
