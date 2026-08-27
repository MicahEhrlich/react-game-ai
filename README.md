# Glitch Shift Arcade

A high-dopamine web arcade game. You are inside a corrupted arcade machine that
cannot hold one game for long: the **mode** swaps every 18–30 seconds —
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
| The live director | `src/director/LlmDirector.ts` + `server/` — optional, falls back to the rules engine |
| Run analytics + API seam | `src/director/telemetry.ts`, `stageOverrides.ts` |

Art is ASCII pixel data compiled to a canvas atlas at boot and audio is
synthesised WebAudio, so there is no asset pipeline and no loading screen.

Every run opens on a **random** one of the three modes, so no two runs start the
same way.

## Tuning

Stage lengths live in [`public/config/pacing.json`](public/config/pacing.json),
in seconds. Edit it and start a new run — no rebuild, no reload:

```json
{ "firstStageSeconds": 20, "baseStageSeconds": 30,
  "taperPerShiftSeconds": 2, "taperShifts": 6,
  "minStageSeconds": 18,    "maxStageSeconds": 30 }
```

Defaults give a 20s opener, then stages starting at 30s and tapering down to
18s over the next 6 shifts. Every value is validated and clamped on load, so a
typo degrades to the built-ins rather than breaking the game, and
`min`/`maxStageSeconds` bound *every* path into a stage — the director, server
overrides, and dev overrides alike. `maxStageSeconds` is the actual guarantee
that no stage ever runs longer than that, independent of what the other
fields compute.

## Scripts

```bash
npm run build                 # tsc -b && vite build
npm run typecheck             # tsc -b
npm run lint                  # oxlint
npm run validate              # all five invariant scripts below
npm run validate-modes        # asserts every game mode is fully registered
npm run validate-director     # asserts the Director can never emit an unplayable stage
npm run validate-runner       # asserts every reachable runner stage is survivable
npm run validate-llm-director # asserts a hostile model response can't reach a stage
npm run validate-levels       # asserts the curated easy levels stay playable
npm run gen-levels            # (re)curates the easy platformer level pack
```

`validate-llm-director` needs no API key and makes no network call — it drives
the real `LlmDirector` with a fake transport and a corpus of hostile responses.

## Difficulty presets and level curation

Add `?difficulty=easy` or `?difficulty=hard` to the URL to play at either end
of the modifier range instead of whatever the director is currently choosing
(`?difficulty=normal` for the untouched default). For the platformer, Easy
also swaps in a level from a curated pack instead of a fully random seed.

That pack isn't hand-authored. `npm run gen-levels` sweeps thousands of seeds
at the Easy preset, checks each against the player's actual jump physics —
[`src/game/levels/levelCheck.ts`](src/game/levels/levelCheck.ts), not the
generator's own "this should be fine" comments — and writes the gentlest ones
to [`src/game/levels/easyPlatformerLevels.ts`](src/game/levels/easyPlatformerLevels.ts).
`npm run validate-levels` re-checks that committed list on every run, so a
change to the generator or the preset that would make one of those levels
unfair fails immediately instead of showing up in someone's playthrough.

Building the checker surfaced a real bug along the way: the platformer's jump
launched at a fixed velocity regardless of `gravityScale`, so a high-gravity
stage silently shrank the jump below what pit widths assume are clearable —
the same class of bug already fixed for the runner (see CLAUDE.md invariant
8), just never applied to the platformer. Fixed the same way, with a
regression check across the full modifier space.

## The live director (optional)

By default the game ships with the deterministic rules engine and no network
dependency at all. Add an API key and a **live director** takes over the writing:
the glitch overlay's notes become taunts about the run you are actually having,
and the game-over panel gets a one-line epitaph.

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local   # already gitignored
npm run dev
```

How it stays safe:

- The key never reaches the browser. `server/directorEndpoint.ts` is a Vite
  middleware serving `POST /api/director` in **dev and preview only**, so
  `npm run build` produces a static bundle with no endpoint and no key.
- **No key is the normal path, not an error path.** With no key, no server, a
  timeout, or a garbage response, the endpoint answers `204` and the rules
  engine decides. The game is indistinguishable from before.
- The model's answer is treated as hostile input. `src/director/llmPlan.ts`
  bounds every number, enforces the mode and chaos rules `clampModifiers()`
  can't see, and strips control characters and markdown out of anything headed
  for the screen.
- Timing, not speed, is what makes it work: the request is issued the instant a
  stage starts and is not needed until three seconds before that stage ends,
  giving it up to the stage's own length (18–30s) to answer. At the short end
  that's tight against the request's own 20s timeout, so on the shortest
  stages the heuristic ends up serving more often — a safe degradation, not a
  bug, but worth knowing if the `⌁` marker seems rare.

A `⌁` beside `SHIFT n` in the HUD marks a stage the live director wrote.
`?ai=0` forces the rules engine, `?ai=1` forces the live director on.

Shipping this for real would need the same handler behind a serverless function
with the key as a platform secret, plus rate limiting and a spend cap.

## Extending it

`CLAUDE.md` documents the architecture invariants — including two Phaser traps
that produce bugs which look nothing like their cause. Read it before adding a
scene, a modifier, or a collider.

The two seams built for a future backend both follow the same swappable-
interface pattern already used for high scores:

- **`Director`** (`src/director/types.ts`) — `LlmDirector` is the worked
  example. `clampModifiers()` sits between any director and the game, so a bad
  or hostile decision can't produce an out-of-range stage; the rules it *can't*
  see (mode repeats, chaos timing) live in `src/director/llmPlan.ts`.
- **`TelemetrySink`** — `LocalTelemetrySink` writes runs to `localStorage`
  today; an `HttpTelemetrySink` against a Node/Express API is a drop-in.

Per-stage difficulty can also be driven from a server payload today: see
`public/mock/overrides.json` and `src/director/stageOverrides.ts`. It is fetched
once per run and read synchronously per shift, so a slow or failed request
degrades to "the local director decides" rather than stalling a transition.
