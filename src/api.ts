const PROD_API_BASE = 'https://react-game-ai-server.onrender.com/'

interface ViteEnv {
  readonly PROD?: boolean
  readonly VITE_API_BASE_URL?: string
}

function cleanBase(raw: string | undefined): string {
  return (raw ?? '').replace(/\/+$/, '')
}

export function apiUrl(path: `/api/${string}`): string {
  const env = (import.meta as ImportMeta & { readonly env?: ViteEnv }).env
  const configured = cleanBase(env?.VITE_API_BASE_URL)
  const base = configured || (env?.PROD ? PROD_API_BASE : '')
  return `${base}${path}`
}
