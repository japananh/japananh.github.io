// Portfolio interactions: footer year, scroll reveal, top-bar edge, latest posts from the blog feed.
(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const yr = document.getElementById("yr");
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* ---------- scroll reveal ---------- */

  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        seen.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -24px 0px" });
    reveals.forEach((el) => seen.observe(el));
  }

  /* ---------- top bar ---------- */

  const bar = document.getElementById("bar");
  const onScroll = () => bar && bar.classList.toggle("solid", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- latest posts ---------- */

  // The HTML already lists the latest posts; this only refreshes them when the blog has moved on.
  const list = document.getElementById("posts");
  if (!list || !window.fetch || !window.DOMParser) return;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  // Posts are dated in Hanoi time; render in UTC+7 so the day matches the blog regardless of the visitor's zone.
  const hanoi = (d) => new Date(d.getTime() + 7 * 3600 * 1000);

  const item = (post) => {
    const d = hanoi(post.date);
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.className = "mono";
    time.dateTime = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    time.textContent = `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    const a = document.createElement("a");
    a.href = post.path;
    a.textContent = post.title;
    li.append(time, a);
    return li;
  };

  fetch("/blog/index.xml")
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((xml) => {
      // Post bodies are embedded verbatim and one contains a raw control character, which strict XML parsing rejects.
      const clean = xml.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
      const doc = new DOMParser().parseFromString(clean, "application/xml");
      if (doc.querySelector("parsererror")) return;
      const text = (el, tag) => (el.querySelector(tag) || {}).textContent || "";
      const posts = [...doc.querySelectorAll("item")]
        .map((it) => {
          let path = "";
          try { path = new URL(text(it, "link")).pathname; } catch (e) {}
          return { title: text(it, "title").trim(), path, date: new Date(text(it, "pubDate")) };
        })
        // The feed also carries pages like Archives and Search; only /blog/p/ entries are posts.
        .filter((p) => p.title && p.path.startsWith("/blog/p/") && !isNaN(p.date))
        .sort((a, b) => b.date - a.date)
        .slice(0, 5);
      if (posts.length) list.replaceChildren(...posts.map(item));
    })
    .catch(() => {});
})();
