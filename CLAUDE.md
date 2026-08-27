# glitch-shift-arcade

An arcade game where the gameplay **mode** swaps every 18–30s (platformer →
shooter → runner) while score, health and multiplier carry across, and a
Game Director reads the player's metrics to tune the next stage.

Phaser runs the game; React runs the shell (menu, HUD, glitch overlay, touch
controls, high scores).

## Stack

**Phaser 4.2** — not Phaser 3. Most Phaser material online is v3 and the APIs
differ. Check `node_modules/phaser/types/phaser.d.ts` (and `src/`) before
trusting a remembered API.

React 19 (StrictMode), Vite 8, TypeScript 6, oxlint. No test framework.

## Commands

```bash
npm run dev                # dev server on :5173 (prefer the preview tooling over Bash)
npm run build              # tsc -b && vite build
npm run typecheck          # tsc -b
npm run lint               # oxlint
npm run validate              # all five scripts below
npm run validate-modes        # asserts every game mode is fully registered
npm run validate-director     # asserts the Director's invariants over ~1800 cases
npm run validate-runner       # asserts every reachable runner stage is survivable
npm run validate-llm-director # asserts a hostile model response can't reach a stage
npm run validate-levels       # asserts the curated easy levels & difficulty presets hold
npm run gen-levels            # re-curates the easy platformer level pack (not a check)
```

`validate-llm-director` needs no API key and makes no network call: the
transport is an injected interface, so it drives the real `LlmDirector` with a
corpus of hostile responses. Run it after touching anything in `src/director/`.

### Adding a game mode

Add a key to `MODE` in `src/state/types.ts` and **follow the compile errors** —
that is the whole procedure. `ALL_MODES` is derived from `MODE`, and every
place that needs a per-mode decision is a `Record<GameMode, …>`, so the
compiler names each one: `MODE_LABEL`, `MODE_BLURB` (the line the Director's
prompt shows the model), `SCENE_FOR_MODE`, and `MODE_SCENES` in `config.ts`.
Everything mechanical — the metrics fixtures, the response schema's mode enum,
the telemetry payload, the prompt's "# THE MODES" block — derives from
`ALL_MODES` and needs no edit at all.

Two things no type can reach, both covered by `npm run validate-modes`: the
label must be **≤ 9 characters** (it renders in the HUD's mode slot and as the
glitch overlay's headline), and the blurb must actually describe the mode.
`BootScene` additionally asserts at boot that every mode routes to a registered
scene that declares the matching `modeId` — the failure that otherwise shows up
as a black screen twenty seconds into a run, pointing nowhere near its cause.

`CHAOS_UNLOCK_SHIFT` is `ALL_MODES.length`: chaos flags stay locked until the
player has seen one full sweep of the modes, so adding a mode delays the first
chaos flag by one shift automatically.

`gen-levels` sweeps a few thousand platformer seeds at the Easy difficulty
preset, checks each with the real jump physics (`levelCheck.ts`), and writes
the gentlest ones to `src/game/levels/easyPlatformerLevels.ts` — a generated
file, not hand-edited. Run it after changing `generatePlatformer.ts`,
`platformerPacing.ts`, or the Easy preset in `difficulty.ts`; `validate-levels`
then re-checks that committed list against whatever changed.

### Tuning stage length (`public/config/pacing.json`)

Stage lengths are **config, not code**. Edit the JSON (values in seconds) and
start a new run — no rebuild, no reload. `ShiftDirectorScene.startRun()`
re-reads it every run.

```json
{ "firstStageSeconds": 20, "baseStageSeconds": 30,
  "taperPerShiftSeconds": 2, "taperShifts": 6,
  "minStageSeconds": 18,    "maxStageSeconds": 30 }
```

The file is hand-edited, so `applyPacing` treats it as untrusted: every field
is validated and clamped, an inverted min/max is corrected, and a malformed or
missing file leaves `DEFAULT_PACING` standing. It can't break the game.
`min`/`maxStageSeconds` become the bounds `clampModifiers` enforces, so they
govern the director, server overrides and `?mods=` alike.

### Dev URL overrides (`src/dev.ts`)

These make transition bugs reproducible in seconds instead of a minute. All
are stripped from production builds.

**If a stage feels far too short, check for `?shift=` in the URL first** — it
bypasses the clamp, and a leftover one is indistinguishable from a bug.

| Param | Effect |
| --- | --- |
| `?mode=shooter` | Boot straight into one mode (`platformer`/`shooter`/`runner`) |
| `?shift=5000` | 5s stages. Deliberately bypasses the 18–30s clamp |
| `?mods=invertControls` | Force modifiers. Also `?mods=spawnRateScale=2` |
| `?physics=1` | Arcade physics debug bodies |
| `?god=1` | Ignore all damage |
| `?ai=0` | Force the heuristic director. `?ai=1` forces the live one on |
| `?difficulty=easy` | Apply the Easy modifier preset; platformer also draws from the curated easy level pack instead of a random seed. `?difficulty=hard` for the other end |

**`?shift=` and the live director don't mix.** A 5s stage cannot fit a request
plus the 3s warning window, so every stage falls back to the heuristic. That is
expected, and it looks exactly like the live director being broken.

## Layout

```
src/state/      store (discrete -> React), commands (React -> Phaser),
                runState (survives scene swaps), metrics (per-frame safe)
src/director/   Director interface, HeuristicDirector, clampModifiers,
                telemetry sink, stage overrides  (Tasks: AI director + API seam)
                LlmDirector (cache + fallback), llmPlan (untrusted-response
                validation), httpTransport, index.ts (the one on/off switch)
server/         dev+preview-only POST /api/director; the API key lives here and
                never reaches the browser. Excluded from every build.
src/game/       config, constants, unified input, touch, audio, taunts,
                runnerPacing / platformerPacing (pure jump maths, asserted by
                a script)
  art/          ASCII pixel sprites -> one canvas atlas, built at boot
  entities/     Avatar (platformer), Walker/Flyer
  levels/       seeded procedural platformer generator, levelCheck (real
                playability check), difficulty (Easy/Normal/Hard presets),
                easyPlatformerLevels (generated, see `npm run gen-levels`)
  scenes/       BootScene, ShiftDirectorScene (orchestrator), ModeScene (base),
                PlatformerScene, SpaceShooterScene, RunnerScene
src/ui/         React shell; GameCanvas.tsx mounts Phaser
src/scores/     high scores, localStorage behind a swappable interface
```

## Invariants

Break one of these and you get a bug that looks unrelated to the change that
caused it. Several are inherited from the sibling `react-game` project; four
were found the hard way here and are marked ⚠️.

### 1. Reset every scene field at the top of `create()` / `setupMode()`

Phaser instantiates each Scene **once**. `scene.launch()`/`start()` on a
stopped scene re-runs `create()` on the **same instance**, with every field
still holding the previous stage's value. `ModeScene.create()` resets its own
fields; each subclass resets its own at the top of `setupMode()`.

**Adding a field and adding its reset is one edit, never two.** Forgetting it
looks like: stage 1 fine, stage 2 has ghost objects or a flag stuck `true`.

The same rule applies to any non-scene object that outlives a run.
`LlmDirector` is one: `beginRun()` is its `create()`, and it must reset every
field and abort anything still in flight. Forgetting it there looks like: run 2
opens with taunts about run 1.

### 2. `gameStore` holds discrete state only

Every `patch()` notifies React through `useSyncExternalStore`. Nothing
per-frame goes in. The shift countdown is the one derived-from-per-frame
value, and it is **quantised to whole seconds** in `ShiftDirectorScene.update()`
before it is patched — `patch()` no-ops when unchanged, so it costs one
re-render per second. Use the same trick, or draw the value inside Phaser.

Touch input follows the same rule for the same reason: `game/touch.ts` is a
plain module, not React state.

### 3. The React ↔ Phaser bridge is two singletons

- **React → Phaser**: `commands.send({ type })`; `ShiftDirectorScene.onCommand`
  is the one switch that handles every command.
- **Phaser → React**: `gameStore.patch(...)`.

Game over is raised inside `gameStore.damage()`, and the orchestrator learns
about it by *subscribing to the store* — not by adding a third channel. Don't
add one. Don't reach into a scene from React.

### 4. ⚠️ `this.scene.launch(key)`, never `this.scene.start(key)`

`ScenePlugin.start` queues a **stop on the calling scene**:

```js
start: function (key, data) {
    this.manager.queueOp('stop', this.key);   // <- the caller
    this.manager.queueOp('start', key, data);
}
```

`ShiftDirectorScene` must outlive every mode scene, so it uses `launch()`.
Using `start()` there shuts the director down and silently freezes the shift
clock — the game keeps playing and simply never shifts again.

### 5. ⚠️ Never reassign an array that a collider was registered with

`physics.add.overlap(a, arr)` captures a reference to **that array object**.
`this.enemies = this.enemies.filter(...)` leaves the collider pointing at a
stale array and every shot silently stops hitting anything. Mutate in place
(`splice`, `length = 0`); see `SpaceShooterScene.removeEnemy`.

Relatedly (inherited): enemies live in a plain array, **never** a physics
`Group` — `Group#add()` reapplies the group's default body config to every
member, including `allowGravity: true`, which undoes `Flyer`'s
`setAllowGravity(false)`.

### 6. Every modifier passes through `clampModifiers()`

`StageModifiers` is the mode-agnostic difficulty vocabulary the director emits
and each `setupMode()` interprets. `clampModifiers` forces the numbers into
playable ranges and enforces "at most one chaos flag". It is applied **last**,
after the server override and the `?mods=` dev override, so nothing that
reaches a scene has skipped it.

**But know what it does not cover.** `clampModifiers` never sees `plan.mode`
and has no history, so three invariants are outside it entirely:

- the next mode is never the current mode,
- a chaos flag never lands two stages running,
- a chaos flag never lands before `CHAOS_UNLOCK_SHIFT`.

`HeuristicDirector` gets all three right by construction. A model does not, so
for an untrusted plan they are enforced in `director/llmPlan.ts` — **the only
place**, and the same file that bounds note text before it reaches the overlay.
A second director path that skips `applyLlmPlan` would break them silently.
`CHAOS_UNLOCK_SHIFT` lives in `modifiers.ts` so both directors read one copy.

`runState.modifiers` is snapshotted into `ModeScene.mods` at `create()`, so a
running scene can never desync from the world it built.

### 7. ⚠️ In `scene.update()`, read the BODY — the sprite is a frame stale

Phaser's per-frame order is `world.update` (bodies integrate) → `scene.update`
→ `world.postUpdate` (**sprite ← body**). So inside `update()` a sprite's `x`/`y`
is still where the *previous* frame left it, while `body.bottom` / `body.y` are
current.

`RunnerScene.applyGround()` read `this.runner.y`. One frame after a jump
launched, the stale value still read "on the ground", so the clamp zeroed the
upward velocity: **the jump collapsed from 64px to 5.4px** and the player could
not clear a 15px block. It presented as "the jump feels weak", which points
nowhere near the cause.

Anything doing manual collision or position clamping reads the body
(`resolveGround` in `runnerPacing.ts`), and treats an upward velocity as
never-grounded regardless of position. `body.y` also has a setter — correcting
the body *and* the sprite is needed, since `postUpdate` only adds a delta.

### 8. ⚠️ Runner obstacle spacing is derived from the jump arc, never from a timer

`RunnerScene` spawns on a timer **and** a distance gate (`gapClear()`), and the
distance gate is load-bearing. Timer-only spawning shipped once: the director's
`spawnRateScale = 1.45` — its reward for good shooting — produced 180px gaps
against a 213px jump arc, so *every* such stage was unwinnable. It presented as
"the jump feels too weak", which points nowhere near the cause.

Two rules follow:

- **The jump arc is not negotiable.** `spawnRateScale` spends the reaction
  *buffer* only (`runnerPacing.reactionBufferSec`). The arc itself is always
  fully protected.
- **Jump height is a distance, not a velocity.** `RUNNER_JUMP_APEX_PX` is fed
  through `jumpVelocity(gravityY)`, so `gravityScale` changes how the jump feels
  and never what it can clear. A fixed velocity makes apex = v²/2g, which
  silently cut the jump from 60px to 38px exactly when the director raised
  gravity to make a stage harder.

The maths lives in `game/runnerPacing.ts` (pure, no Phaser) so
`npm run validate-runner` can assert it across the whole modifier space.

**The platformer had the sibling bug, unfixed, until `game/platformerPacing.ts`
existed.** `Avatar.drive()` launched every jump at a fixed `JUMP_VELOCITY`
while `ModeScene.create()` scales gravity by `mods.gravityScale` — so at
`gravityScale` above ~1.1, `apex = v²/(2·gravityY·scale)` quietly shrinks the
jump below what `generatePlatformer`'s pit widths assume. It went unnoticed
because the heuristic director never raises `gravityScale` above 1; only
`?mods=` or a live LLM director's full allowed range would ever hit it. Fixed
the same way: `platformerPacing.jumpVelocity(gravityY)` derives launch speed
from a fixed apex, `Avatar` reads live gravity instead of the constant, and
`generatePlatformer`'s pit-width cap is derived from the same real jump
distance rather than a bare `randInt(2, 3)`. `scripts/validate-levels.ts`
sweeps the full modifier space asserting every pit stays clearable, and
proves (check 3b) that the pre-fix cap would actually have failed the harsh
case — so it isn't asserting against a bug that could never have happened.

### 9. Per-scene gravity

Each scene owns its own arcade World. The gravity in `config.ts` is only a
default — every `ModeScene.create()` sets `this.physics.world.gravity.y`
itself, and `SpaceShooterScene` sets it to `0`. A shooter running under the
platformer's gravity is the exact bug this prevents.

### 10. Assets: procedural first, files optional

All art is ASCII pixel data in `art/sprites.ts` composited into one canvas
atlas at boot; all core audio is synthesised WebAudio. **There is no
`preload()`.** Voice taunts (`game/taunts.ts`) are the one exception: fetched
lazily *after* audio unlock, and falling back to a synthesised phrase when
absent — which is the repo's default state. Drop files at
`public/audio/taunts/<id>.webm` to enable them; no code change needed.

### 11. StrictMode double-invokes

`main.tsx` renders in StrictMode, so mount → unmount → mount happens in dev.
Anything registered globally needs an idempotence guard, as `buildAtlas`
(`textures.exists`) and `createAnims` (`anims.exists`) both have. `GameCanvas`
defers destroying a mid-boot `Phaser.Game` until it reports `READY`.

## TypeScript traps

All compile errors, not style preferences (see `tsconfig.app.json`):

| Setting | Forbids |
| --- | --- |
| `allowImportingTsExtensions` | Imports **must** carry `.ts` / `.tsx` |
| `erasableSyntaxOnly` | No `enum`, no constructor parameter properties. Hence the `as const` object + `(typeof X)[keyof typeof X]` idiom (`MODE`, `PHASE`, `SOLID`, `DEPTH`) |
| `verbatimModuleSyntax` | Type-only imports must say `import type` |
| `noUnusedLocals` / `noUnusedParameters` | A leftover import or unused private field fails the build |
| `strict` | `body` is `Body \| StaticBody`; cast once per method |

`StageModifiers` is fully `readonly`, so anything that *builds* a modifier set
uses `ModifierDraft` (the mapped `-readonly` partial in `director/types.ts`).
