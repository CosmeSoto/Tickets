export function ThemeScript() {
  const script = `
    (function() {
      try {
        const theme = localStorage.getItem('theme') || 'system';
        const root = document.documentElement;
        
        root.classList.remove('light', 'dark');
        
        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          root.classList.add(systemTheme);
          root.setAttribute('data-theme', systemTheme);
        } else {
          root.classList.add(theme);
          root.setAttribute('data-theme', theme);
        }
      } catch (e) {
        // Fallback en caso de error
        document.documentElement.classList.add('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}