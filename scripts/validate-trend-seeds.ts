import { CURATED_TREND_SEEDS, fetchTrendSeeds, parseTrendSeeds } from '../server/trendSeeds.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

console.log('validate-trend-seeds')

const fixture = `<?xml version="1.0"?>
<rss><channel>
  <title>Daily Search Trends</title>
  <item><title><![CDATA[six seven]]></title></item>
  <item><title>funny basketball edit</title></item>
  <item><title>politics polls</title></item>
  <item><title>someone died</title></item>
  <item><title>rizz</title></item>
  <item><title>https://example.com</title></item>
</channel></rss>`

const parsed = parseTrendSeeds(fixture).map((t) => t.label)
if (!parsed.includes('SIX SEVEN')) fail('did not parse SIX SEVEN')
if (!parsed.includes('FUNNY BASKETBALL EDIT')) fail('did not parse safe trend')
if (!parsed.includes('RIZZ')) fail('did not parse RIZZ')
if (parsed.some((t) => t.includes('POLITICS') || t.includes('DIED') || t.includes('HTTP'))) {
  fail('unsafe trends were not filtered')
}

{
  const seeds = await fetchTrendSeeds(async () => {
    throw new Error('offline')
  })
  if (seeds.length !== CURATED_TREND_SEEDS.length) fail('offline fetch did not return curated seeds')
  if (!seeds.some((s) => s.label === 'SIX SEVEN')) fail('curated seeds do not include SIX SEVEN')
}

{
  const seeds = await fetchTrendSeeds(async () => ({
    ok: true,
    text: async () => fixture,
  } as Response))
  if (!seeds.some((s) => s.source === 'google-trends')) fail('successful fetch did not include live seeds')
  if (seeds.length > 6) fail(`fetch returned ${seeds.length} seeds, expected at most 6`)
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  trend seeds parse and fall back safely')
