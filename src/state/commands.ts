import type { GameCommand } from './types.ts'

type Handler = (c: GameCommand) => void

// Module-level, so it survives React StrictMode's mount -> unmount -> mount
// without losing in-flight subscriptions.
const handlers = new Set<Handler>()

export const commands = {
  on(h: Handler): () => void {
    handlers.add(h)
    return () => {
      handlers.delete(h)
    }
  },
  send(c: GameCommand): void {
    for (const h of [...handlers]) h(c)
  },
}
