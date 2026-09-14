// Layout primitives shared by every screen.
// Each screen is a column: fixed chrome on top, one scrolling region below.
// Kept in its own module so screens and the shell never import each other.

export function ScreenShell({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>{children}</div>
  );
}

export function ScreenScroll({ children }) {
  return (
    <div data-scroll style={{
      flex: 1, overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>{children}</div>
  );
}
