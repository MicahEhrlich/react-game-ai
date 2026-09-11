export function FatalError(): React.JSX.Element {
  return (
    <main className="fatal-error" role="alert">
      <p className="fatal-error__code">SYSTEM FAULT</p>
      <h1>THE ARCADE GLITCHED OUT</h1>
      <p>The error was recorded without your gameplay data.</p>
      <button type="button" onClick={() => window.location.reload()}>REBOOT</button>
    </main>
  )
}
