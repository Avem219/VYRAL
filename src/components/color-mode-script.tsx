const COLOR_MODE_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('vyral-color-mode');
    var mode = stored === 'light' || stored === 'dark' ? stored : 'system';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
    if (resolved === 'light') {
      document.documentElement.setAttribute('data-mode', 'light');
    }
  } catch (e) {}
})();
`;

export function ColorModeScript() {
  return <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />;
}
