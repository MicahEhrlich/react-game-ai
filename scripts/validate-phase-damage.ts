import { PHASE, acceptsGameplayDamage } from '../src/state/types.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

console.log('validate-phase-damage')

for (const phase of Object.values(PHASE)) {
  const allowed = acceptsGameplayDamage(phase)
  if (phase === PHASE.Playing) {
    if (!allowed) fail('Playing phase does not accept damage')
  } else if (allowed) {
    fail(`${phase} phase accepts damage`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  gameplay damage is accepted only while playing')
