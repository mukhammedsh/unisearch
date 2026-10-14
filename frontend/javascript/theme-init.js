(() => {
  const KEY = "unisearch_theme";
  try {
    const saved = localStorage.getItem(KEY);
    const hasSaved = saved === "dark" || saved === "light";
    const systemDark =
      !hasSaved &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = hasSaved ? saved : (systemDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  }

  const syncBrowserThemeColor = () => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    if (!accent) return;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    meta.content = accent;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncBrowserThemeColor, { once: true });
  } else {
    syncBrowserThemeColor();
  }

  const themeObserver = new MutationObserver(syncBrowserThemeColor);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
})();
