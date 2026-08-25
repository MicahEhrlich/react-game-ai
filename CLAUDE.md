# glitch-shift-arcade

An arcade game where the gameplay **mode** swaps every 60–90s (platformer →
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
npm run validate-director  # asserts the Director's invariants over ~1800 cases
```

### Dev URL overrides (`src/dev.ts`)

These make transition bugs reproducible in seconds instead of 90. All are
stripped from production builds.

| Param | Effect |
| --- | --- |
| `?mode=shooter` | Boot straight into one mode (`platformer`/`shooter`/`runner`) |
| `?shift=5000` | 5s stages. Deliberately bypasses the 60–90s clamp |
| `?mods=invertControls` | Force modifiers. Also `?mods=spawnRateScale=2` |
| `?physics=1` | Arcade physics debug bodies |
| `?god=1` | Ignore all damage |

## Layout

```
src/state/      store (discrete -> React), commands (React -> Phaser),
                runState (survives scene swaps), metrics (per-frame safe)
src/director/   Director interface, HeuristicDirector, clampModifiers,
                telemetry sink, stage overrides  (Tasks: AI director + API seam)
src/game/       config, constants, unified input, touch, audio, taunts
  art/          ASCII pixel sprites -> one canvas atlas, built at boot
  entities/     Avatar (platformer), Walker/Flyer
  levels/       seeded procedural platformer generator
  scenes/       BootScene, ShiftDirectorScene (orchestrator), ModeScene (base),
                PlatformerScene, SpaceShooterScene, RunnerScene
src/ui/         React shell; GameCanvas.tsx mounts Phaser
src/scores/     high scores, localStorage behind a swappable interface
```

## Invariants

Break one of these and you get a bug that looks unrelated to the change that
caused it. Several are inherited from the sibling `react-game` project; two
were found the hard way here and are marked.

### 1. Reset every scene field at the top of `create()` / `setupMode()`

Phaser instantiates each Scene **once**. `scene.launch()`/`start()` on a
stopped scene re-runs `create()` on the **same instance**, with every field
still holding the previous stage's value. `ModeScene.create()` resets its own
fields; each subclass resets its own at the top of `setupMode()`.

**Adding a field and adding its reset is one edit, never two.** Forgetting it
looks like: stage 1 fine, stage 2 has ghost objects or a flag stuck `true`.

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
reaches a scene has skipped it. This is what makes a future LLM-backed
`Director` safe to drop in behind the same interface.

`runState.modifiers` is snapshotted into `ModeScene.mods` at `create()`, so a
running scene can never desync from the world it built.

### 7. Per-scene gravity

Each scene owns its own arcade World. The gravity in `config.ts` is only a
default — every `ModeScene.create()` sets `this.physics.world.gravity.y`
itself, and `SpaceShooterScene` sets it to `0`. A shooter running under the
platformer's gravity is the exact bug this prevents.

### 8. Assets: procedural first, files optional

All art is ASCII pixel data in `art/sprites.ts` composited into one canvas
atlas at boot; all core audio is synthesised WebAudio. **There is no
`preload()`.** Voice taunts (`game/taunts.ts`) are the one exception: fetched
lazily *after* audio unlock, and falling back to a synthesised phrase when
absent — which is the repo's default state. Drop files at
`public/audio/taunts/<id>.webm` to enable them; no code change needed.

### 9. StrictMode double-invokes

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
