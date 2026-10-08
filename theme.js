// Theme toggle shared by every page. The inline <head> script has already set
// data-theme before first paint; this wires the buttons and persists changes.
(() => {
  "use strict";

  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const BAR_COLOR = { light: "#f5f6fa", dark: "#070b16" };
  const buttons = document.querySelectorAll("[data-theme-toggle]");

  const current = () => (root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  const apply = (theme) => {
    root.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", BAR_COLOR[theme]);
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(theme === "dark")));
  };

  buttons.forEach((b) => b.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    apply(next);
    // Storage can throw (private mode, blocked cookies); the toggle still works for this page view.
    try { localStorage.setItem("theme", next); } catch (e) {}
  }));

  apply(current());
})();
