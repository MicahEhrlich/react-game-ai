/**
 * Structural check on the MODE REGISTRATION SURFACE, in the same shape as
 * validate-director and validate-runner: a plain node script that fails
 * loudly, because there is no test framework here.
 *
 * It exists because adding a game mode used to have SEVEN sites the compiler
 * said nothing about, each with its own silent failure: a mode that is never
 * picked, one that black-screens mid-run, one the model cannot structurally
 * choose, one the model chooses blind, one invisible in telemetry, a coverage
 * gap in the hostile-response sweep, and a label that overflows the HUD.
 *
 * Most of those are now impossible by construction -- ALL_MODES is derived
 * from MODE, the scene list and the prompt's mode blurbs are
 * Record<GameMode, ...>, and the schema enum and telemetry payload loop
 * ALL_MODES. This script covers the remainder (the editorial content and the
 * label geometry) and re-asserts the derived ones, so they cannot be quietly
 * un-derived by someone "simplifying" them back to a literal.
 *
 * Runs first in `npm run validate`: a broken registration should fail before
 * anything spends time simulating runs against it.
 */
import { ALL_MODES, MODE, MODE_BLURB, MODE_LABEL } from '../src/state/types.ts'
import { SCENE, SCENE_FOR_MODE } from '../src/game/scenes/keys.ts'
import { CHAOS_FLAGS } from '../src/director/modifiers.ts'
import { PLAN_FORMAT, SYSTEM } from '../server/directorPrompt.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

/**
 * Longest label the UI can take.
 *
 * An INDEPENDENT literal, deliberately not derived from the existing labels:
 * deriving it from `Math.max(...labels.map(l => l.length))` would make the
 * check tautological and it would pass no matter how long a label grew. The
 * number comes from the layout -- STARFIGHT is 9 characters and is already
 * proven to fit `.hud-value--mode` in the HUD and `.glitch-title` at the
 * overlay's largest type size.
 */
const LABEL_MAX_LEN = 9
/** A blurb shorter than this cannot actually describe a mode to the model. */
const BLURB_MIN_LEN = 30

console.log('validate-modes')

// --- 1: the registry is internally consistent -----------------------------
{
  const modeKeys = Object.keys(MODE)
  if (ALL_MODES.length !== modeKeys.length) {
    fail(
      `ALL_MODES has ${ALL_MODES.length} entries but MODE has ${modeKeys.length} keys -- ` +
        'ALL_MODES is supposed to be derived from MODE, not hand-listed',
    )
  }
  // "the next mode is never the current mode" is unsatisfiable below two.
  if (ALL_MODES.length < 2) {
    fail(`only ${ALL_MODES.length} mode(s): the never-repeat-a-mode rule cannot be satisfied`)
  }
  if (new Set(ALL_MODES).size !== ALL_MODES.length) {
    fail('ALL_MODES contains a duplicate')
  }
}

// --- 2: labels fit, and are distinct --------------------------------------
// A label that overflows is a visual bug nothing else would catch; two modes
// sharing a label makes the glitch overlay announce the wrong game.
{
  const seen = new Map<string, string>()
  for (const mode of ALL_MODES) {
    const label = MODE_LABEL[mode]

    if (!label || label.trim().length === 0) {
      fail(`mode "${mode}" has an empty label`)
      continue
    }
    if (label.length > LABEL_MAX_LEN) {
      fail(
        `label "${label}" for mode "${mode}" is ${label.length} chars, over the ` +
          `${LABEL_MAX_LEN}-char limit the HUD and glitch overlay can render`,
      )
    }
    if (label !== label.toUpperCase()) {
      fail(`label "${label}" for mode "${mode}" is not uppercase`)
    }
    if (/\s/.test(label)) {
      fail(`label "${label}" for mode "${mode}" contains whitespace`)
    }

    const prior = seen.get(label)
    if (prior) fail(`modes "${prior}" and "${mode}" share the label "${label}"`)
    seen.set(label, mode)
  }
}

// --- 3: wire values are safe to put in a schema and a URL -----------------
{
  for (const mode of ALL_MODES) {
    if (!/^[a-z]+$/.test(mode)) {
      fail(`mode id "${mode}" should be lowercase letters only (it is a schema enum and a ?mode= value)`)
    }
    if ((CHAOS_FLAGS as readonly string[]).includes(mode)) {
      fail(`mode id "${mode}" collides with a chaos flag name`)
    }
  }
}

// --- 4: every mode is actually described to the model ---------------------
// The compiler forces a blurb to EXIST (MODE_BLURB is a Record<GameMode>).
// Only this catches one that exists but says nothing useful.
{
  for (const mode of ALL_MODES) {
    const blurb = MODE_BLURB[mode]
    if (!blurb || blurb.trim().length === 0) {
      fail(`mode "${mode}" has an empty blurb`)
      continue
    }
    if (blurb.length < BLURB_MIN_LEN) {
      fail(
        `blurb for "${mode}" is ${blurb.length} chars -- too short to tell the model ` +
          `what the mode actually is (min ${BLURB_MIN_LEN})`,
      )
    }
  }
}

// --- 5: the mode is reachable through the prompt --------------------------
// Derived from MODE_BLURB/ALL_MODES today, so this is a regression guard: if
// someone re-hardcodes the "# THE MODES" block, a new mode silently vanishes
// from the model's world again.
{
  for (const mode of ALL_MODES) {
    if (!SYSTEM.includes(mode)) {
      fail(`the system prompt never mentions mode "${mode}" -- the model cannot name it`)
    }
    if (!SYSTEM.includes(MODE_LABEL[mode])) {
      fail(`the system prompt never mentions label "${MODE_LABEL[mode]}" for mode "${mode}"`)
    }
  }
}

// --- 6: the mode is reachable through the response schema -----------------
// A mode absent here is one the model is structurally forbidden from ever
// choosing, however well the prompt describes it.
{
  const schema = PLAN_FORMAT.schema as unknown as {
    properties?: { mode?: { enum?: unknown } }
  }
  const modeEnum = schema.properties?.mode?.enum

  if (!Array.isArray(modeEnum)) {
    fail('PLAN_FORMAT.schema.properties.mode.enum is missing or not an array')
  } else {
    for (const mode of ALL_MODES) {
      if (!modeEnum.includes(mode)) {
        fail(`mode "${mode}" is missing from the PLAN_FORMAT schema enum`)
      }
    }
    for (const entry of modeEnum) {
      if (!(ALL_MODES as readonly unknown[]).includes(entry)) {
        fail(`PLAN_FORMAT schema enum contains "${String(entry)}", which is not a real mode`)
      }
    }
  }
}

// --- 7: every mode routes to a distinct, registered scene -----------------
// The Record<GameMode, SceneKey> forces an entry to exist; this catches an
// entry that exists but points at a scene key that was never defined, or at
// the same scene as another mode. (BootScene additionally asserts at runtime
// that the scene is registered with Phaser AND declares the matching modeId,
// which is the part only a live scene manager can know.)
{
  const sceneKeys = new Set<string>(Object.values(SCENE))
  const used = new Map<string, string>()

  for (const mode of ALL_MODES) {
    const key = SCENE_FOR_MODE[mode]
    if (!key) {
      fail(`mode "${mode}" has no SCENE_FOR_MODE entry`)
      continue
    }
    if (!sceneKeys.has(key)) {
      fail(`mode "${mode}" routes to scene key "${key}", which is not in SCENE`)
    }
    const prior = used.get(key)
    if (prior) fail(`modes "${prior}" and "${mode}" both route to scene "${key}"`)
    used.set(key, mode)
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  every mode is registered, described, routable and renderable')
