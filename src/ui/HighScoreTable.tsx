import type { ScoreEntry } from '../scores/index.ts'

export function HighScoreTable({ entries }: { entries: readonly ScoreEntry[] }) {
  if (entries.length === 0) return null

  return (
    <table className="scores">
      <caption>BEST RUNS</caption>
      <tbody>
        {entries.map((e) => (
          <tr key={`${e.at}-${e.name}`}>
            <td>{e.name}</td>
            <td className="scores-num">{e.score.toLocaleString()}</td>
            <td className="scores-num">{e.shifts} shifts</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
