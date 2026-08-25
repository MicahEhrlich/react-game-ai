# Glitch Shift Arcade

A high-dopamine web arcade game. You are inside a corrupted arcade machine that
cannot hold one game for long: the **mode** swaps every 60–90 seconds —
platformer → space shooter → endless runner — while your score, core health and
multiplier carry straight across the break.

A runtime **Game Director** watches how you actually play (accuracy, damage
taken, reaction time, which mode you're weakest at) and rewrites the next stage
around it: spawn rates, gravity, projectile speed, and occasionally something
worse — inverted controls, a mirrored world, a degraded signal.

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

**Controls** — move `←→`/`WASD` · jump `↑`/`Space` · fire `Space`/`Shift` ·
slide `↓` · pause `Esc`. Touch controls appear automatically on touch devices.

## What's here

| Piece | Where |
| --- | --- |
| React ↔ Phaser bridge | `src/state/` — two singletons, nothing else |
| The three modes | `src/game/scenes/*Scene.ts`, all extending `ModeScene` |
| The Glitch Engine | `src/game/scenes/ShiftDirectorScene.ts` + `ui/GlitchOverlay.tsx` |
| The AI Director | `src/director/` — a rules engine behind a `Director` interface |
| Run analytics + API seam | `src/director/telemetry.ts`, `stageOverrides.ts` |

Art is ASCII pixel data compiled to a canvas atlas at boot and audio is
synthesised WebAudio, so there is no asset pipeline and no loading screen.

## Scripts

```bash
npm run build              # tsc -b && vite build
npm run typecheck          # tsc -b
npm run lint               # oxlint
npm run validate-director  # asserts the Director can never emit an unplayable stage
```

## Extending it

`CLAUDE.md` documents the architecture invariants — including two Phaser traps
that produce bugs which look nothing like their cause. Read it before adding a
scene, a modifier, or a collider.

The two seams built for a future backend both follow the same swappable-
interface pattern already used for high scores:

- **`Director`** (`src/director/types.ts`) — implement it with an LLM call and
  drop it into `ShiftDirectorScene`. `clampModifiers()` sits between any
  director and the game, so a bad or hostile decision still can't produce an
  unplayable stage.
- **`TelemetrySink`** — `LocalTelemetrySink` writes runs to `localStorage`
  today; an `HttpTelemetrySink` against a Node/Express API is a drop-in.

Per-stage difficulty can also be driven from a server payload today: see
`public/mock/overrides.json` and `src/director/stageOverrides.ts`. It is fetched
once per run and read synchronously per shift, so a slow or failed request
degrades to "the local director decides" rather than stalling a transition.
