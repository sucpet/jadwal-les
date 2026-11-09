import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupSwAutoUpdate, setupChunkReload } from './sw-update.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

setupSwAutoUpdate()
setupChunkReload()
