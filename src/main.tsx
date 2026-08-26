import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { loadPacing } from './director/pacing.ts'
import './index.css'

// Fired here rather than awaited: the menu gives it far longer than it needs,
// and if it somehow lost the race the built-in defaults are already correct.
// The orchestrator re-reads it at the start of every run.
void loadPacing()

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
