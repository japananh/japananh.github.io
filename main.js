// Portfolio interactions: WebGL background, reveals, nav, counters, pointer effects.
(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const yr = document.getElementById("yr");
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* ---------- WebGL background: flowing aurora over a glowing dot lattice ---------- */

  const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

  const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPtr;
uniform float uLight; // 0 = dark theme, 1 = light theme; eased so toggling cross-fades.

vec2 h2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

// Gradient noise, roughly in [-1, 1].
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(h2(i), f), dot(h2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(h2(i + vec2(0, 1)), f - vec2(0, 1)), dot(h2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0, amp = 0.55;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    s += amp * gnoise(p);
    p = rot * p * 2.02 + 3.1;
    amp *= 0.5;
  }
  return s;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime * 0.035;
  vec2 tilt = (uPtr - 0.5) * 0.25;

  // Warp the domain twice so bands fold like slow smoke.
  vec2 w = vec2(fbm(p * 1.2 + vec2(t, -t)), fbm(p * 1.2 + vec2(5.2 - t, 1.3 + t)));
  float field = fbm(p * 1.5 + 1.7 * w + tilt);

  // Two aurora ribbons along gently curving horizontal paths.
  float r1 = uv.y - 0.72 - 0.12 * sin(p.x * 1.3 + t * 6.0) - 0.15 * field;
  float r2 = uv.y - 0.28 - 0.1 * sin(p.x * 1.1 - t * 5.0 + 2.0) + 0.18 * field;
  float band1 = exp(-r1 * r1 * 28.0);
  float band2 = exp(-r2 * r2 * 22.0);

  float shade = smoothstep(-0.4, 0.6, field);
  vec2 cell = p * 34.0 + tilt * 6.0;
  float dot_ = smoothstep(0.09, 0.0, length(fract(cell) - 0.5));
  float lit = 0.04 + 0.5 * max(band1, band2) * smoothstep(-0.1, 0.5, field);
  float v = smoothstep(1.3, 0.25, length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.15)));

  // Dark: additive glow on navy, dots light up, edges vignetted for text contrast.
  vec3 cyan   = vec3(0.16, 0.77, 0.91);
  vec3 violet = vec3(0.65, 0.55, 0.98);
  vec3 dark = mix(vec3(0.027, 0.043, 0.086), vec3(0.05, 0.075, 0.15), shade);
  dark += cyan * band1 * (0.1 + 0.08 * field);
  dark += violet * band2 * (0.11 + 0.08 * field);
  dark += mix(cyan, violet, uv.x) * dot_ * lit * 0.35;
  dark *= mix(0.68, 1.0, v);

  // Light: additive glow would wash out to white, so ribbons tint the paper
  // instead and the dots darken. Kept faint so body text stays high-contrast.
  vec3 paper = mix(vec3(0.961, 0.965, 0.98), vec3(0.93, 0.94, 0.975), shade);
  vec3 light = paper;
  light = mix(light, vec3(0.62, 0.86, 0.95), band1 * (0.32 + 0.16 * field));
  light = mix(light, vec3(0.80, 0.74, 0.98), band2 * (0.36 + 0.16 * field));
  light = mix(light, mix(vec3(0.04, 0.44, 0.58), vec3(0.42, 0.27, 0.85), uv.x), dot_ * lit * 0.3);
  light = mix(light, vec3(0.961, 0.965, 0.98), (1.0 - v) * 0.35);

  gl_FragColor = vec4(mix(dark, light, uLight), 1.0);
}
`;

  function startBackground() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas || reduceMotion) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return;

    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // One oversized triangle covers the viewport without a second draw.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uPtr = gl.getUniformLocation(prog, "uPtr");
    const uLight = gl.getUniformLocation(prog, "uLight");
    // Read every frame so theme.js needs no hook into the renderer.
    const lightTarget = () => (document.documentElement.getAttribute("data-theme") === "dark" ? 0 : 1);
    let light = lightTarget();

    // Render below native resolution: the image is soft anyway and this keeps laptops cool.
    const scale = Math.min(devicePixelRatio || 1, 1.5) * 0.6;
    const fit = () => {
      const w = Math.max(1, Math.round(innerWidth * scale));
      const h = Math.max(1, Math.round(innerHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    addEventListener("resize", fit, { passive: true });
    fit();

    const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    addEventListener("pointermove", (e) => {
      ptr.tx = e.clientX / innerWidth;
      ptr.ty = 1 - e.clientY / innerHeight;
    }, { passive: true });

    let raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      ptr.x += (ptr.tx - ptr.x) * 0.04;
      ptr.y += (ptr.ty - ptr.y) * 0.04;
      light += (lightTarget() - light) * 0.12;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform2f(uPtr, ptr.x, ptr.y);
      gl.uniform1f(uLight, light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(draw);
    };
    // Paint now: an opaque WebGL canvas is black until its first draw, which flashes on the light theme.
    draw(t0);

    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    });
  }
  startBackground();

  /* ---------- scroll reveal ---------- */

  const fades = document.querySelectorAll(".fade-up");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    fades.forEach((el) => el.classList.add("in"));
  } else {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        seen.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -32px 0px" });
    // Stagger siblings that enter together, capped so long lists don't lag.
    fades.forEach((el) => {
      const i = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = Math.min(i, 4) * 70 + "ms";
      seen.observe(el);
    });
  }

  /* ---------- top bar + active section ---------- */

  const bar = document.getElementById("bar");
  const onScroll = () => bar && bar.classList.toggle("solid", scrollY > 20);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = [...document.querySelectorAll(".menu a")];
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("here", a.hash === "#" + en.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => {
      const sec = document.querySelector(a.hash);
      if (sec) spy.observe(sec);
    });
  }

  /* ---------- mobile menu ---------- */

  const burger = document.getElementById("burger");
  const menu = document.getElementById("menu");
  if (burger && menu) {
    const setOpen = (open) => {
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
    links.forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("open")) {
        setOpen(false);
        burger.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (menu.classList.contains("open") && !menu.contains(e.target) && !burger.contains(e.target)) setOpen(false);
    });
  }

  /* ---------- count-up figures ---------- */

  // The final value is already in the HTML, so no-JS and reduced-motion visitors see real numbers.
  const nums = document.querySelectorAll(".num[data-to]");
  const render = (el, v) => {
    el.textContent = (el.dataset.prefix || "") + v + (el.dataset.suffix || "");
  };
  const countUp = (el) => {
    const to = Number(el.dataset.to);
    const from = Number(el.dataset.from || 0);
    const dur = 1500;
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const k = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      render(el, Math.round(from + (to - from) * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    render(el, from);
    requestAnimationFrame(step);
  };
  if (!reduceMotion && "IntersectionObserver" in window) {
    const watch = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        countUp(en.target);
        watch.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    nums.forEach((el) => watch.observe(el));
  }

  /* ---------- pointer effects (desktop only) ---------- */

  if (finePointer && !reduceMotion) {
    const glow = document.querySelector(".glow");
    if (glow) {
      addEventListener("pointermove", (e) => {
        glow.classList.add("on");
        glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => glow.classList.remove("on"));
    }

    document.querySelectorAll("[data-spot]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--sx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--sy", (y * 100).toFixed(1) + "%");
        card.style.transform = `perspective(1000px) rotateX(${((0.5 - y) * 3).toFixed(2)}deg) rotateY(${((x - 0.5) * 3).toFixed(2)}deg)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }
})();
