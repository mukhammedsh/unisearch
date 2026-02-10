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
})();
