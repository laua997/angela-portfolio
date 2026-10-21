const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarseOnly = window.matchMedia("(pointer: coarse)").matches;

function initCursor() {
  if (coarseOnly || reduce) return;
  const root = document.documentElement;
  const src = document.body.dataset.cursor;
  if (!src) return;

  const logoEl = document.createElement("div");
  logoEl.className = "cursor-logo";
  logoEl.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  img.style.pointerEvents = "none";
  logoEl.style.pointerEvents = "none";
  logoEl.appendChild(img);

  const exploreEl = document.createElement("div");
  exploreEl.className = "cursor-explore";
  exploreEl.textContent = "explore project";
  exploreEl.setAttribute("aria-hidden", "true");
  exploreEl.style.pointerEvents = "none";

  document.body.appendChild(logoEl);
  document.body.appendChild(exploreEl);

  // One follow for both. Stiffness 500 and damping 60 are the explore
  // label's spring; the logo used to be a stiffer 529/40 and lagged less.
  const follow = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  const STIFFNESS = 500;
  const DAMPING = 60;
  let mode = "logo";
  let visible = false;
  let ready = false;
  let failed = false;
  let aimed = false;
  let last = performance.now();

  // Top-left of each follower, measured from the pointer tip. The mark sits
  // closer than the explore label, still clear of the arrow.
  const LOGO_X = 8;
  const LOGO_Y = 14;
  const EXPLORE_X = 16;
  const EXPLORE_Y = 24;
  const place = () => {
    // left/top, not transform: a transform on this element promotes a
    // composited layer and Chrome stops difference-blending it (the white
    // mark stays white). A transformed parent does the same to a child.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clamp = (value, size, limit) => Math.max(0, Math.min(value, Math.max(0, limit - size)));
    logoEl.style.left = `${clamp(follow.x + LOGO_X, 43, vw)}px`;
    logoEl.style.top = `${clamp(follow.y + LOGO_Y, 60, vh)}px`;
    const exploreW = exploreEl.offsetWidth;
    const exploreH = exploreEl.offsetHeight;
    const ex = clamp(follow.x + EXPLORE_X, exploreW, vw);
    const ey = clamp(follow.y + EXPLORE_Y, exploreH, vh);
    exploreEl.style.transform = `translate3d(${ex}px, ${ey}px, 0)`;
  };

  const drop = () => {
    failed = true;
    ready = false;
    visible = false;
    logoEl.remove();
    exploreEl.remove();
  };

  const show = () => {
    if (failed || !ready || visible) return;
    if (getComputedStyle(logoEl).mixBlendMode !== "difference") {
      drop();
      return;
    }
    visible = true;
    place();
    logoEl.classList.add("is-on");
    exploreEl.classList.add("is-on");
  };

  const arm = () => {
    if (failed) return;
    if (!img.naturalWidth) {
      drop();
      return;
    }
    ready = true;
    if (aimed) show();
  };

  const stepSpring = (s, dt) => {
    const ax = -STIFFNESS * (s.x - s.tx) - DAMPING * s.vx;
    const ay = -STIFFNESS * (s.y - s.ty) - DAMPING * s.vy;
    s.vx += ax * dt;
    s.vy += ay * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  };

  const frame = (now) => {
    if (failed) return;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    stepSpring(follow, dt);
    place();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const aim = (x, y) => {
    aimed = true;
    follow.tx = x;
    follow.ty = y;
    if (!visible) {
      follow.x = x;
      follow.y = y;
      follow.vx = follow.vy = 0;
      show();
    }
  };

  img.addEventListener("load", arm);
  img.addEventListener("error", drop);
  img.src = src;
  if (img.complete) arm();

  window.addEventListener("mousemove", (event) => {
    if (failed) return;
    aim(event.clientX, event.clientY);
    const target = event.target instanceof Element ? event.target.closest("[data-cursor='explore']") : null;
    const next = target ? "explore" : "logo";
    if (next !== mode) {
      mode = next;
      logoEl.classList.toggle("is-explore", mode === "explore");
      exploreEl.classList.toggle("is-explore", mode === "explore");
    }
  });
  root.addEventListener("mouseleave", () => {
    if (failed) return;
    visible = false;
    logoEl.classList.remove("is-on", "is-explore");
    exploreEl.classList.remove("is-on", "is-explore");
    mode = "logo";
  });
}

function initDock() {
  const dock = document.querySelector("[data-dock]");
  if (!dock) return;
  const toggle = dock.querySelector("[data-dock-toggle]");
  const setOpen = (open) => {
    dock.classList.toggle("is-open", open);
    toggle?.setAttribute("aria-expanded", open ? "true" : "false");
    toggle?.setAttribute("aria-label", open ? "Close menu" : "Menu");
  };
  toggle?.addEventListener("click", () => setOpen(!dock.classList.contains("is-open")));
  dock.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  if (reduce) return;
  let last = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const down = y > last && y > 80;
    dock.classList.toggle("is-hidden", down && !dock.classList.contains("is-open"));
    last = y;
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );
}

function initReveal() {
  if (reduce) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
    return;
  }
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length || !("IntersectionObserver" in window)) {
    nodes.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 },
  );
  nodes.forEach((node) => io.observe(node));
}

function initFilters() {
  const bar = document.querySelector("[data-filters]");
  if (!bar) return;
  const cards = [...document.querySelectorAll("[data-category]")];
  bar.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-filter]") : null;
    if (!button) return;
    const value = button.getAttribute("data-filter");
    const pressed = button.getAttribute("aria-pressed") === "true";
    bar.querySelectorAll("button[data-filter]").forEach((el) => el.setAttribute("aria-pressed", "false"));
    const next = pressed ? "" : value;
    if (!pressed) button.setAttribute("aria-pressed", "true");
    cards.forEach((card) => {
      const show = !next || card.getAttribute("data-category") === next;
      card.classList.toggle("is-hidden", !show);
    });
  });
}

function initForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "");
    const company = String(data.get("company") || "");
    const budget = String(data.get("budget") || "");
    const email = String(data.get("email") || "");
    const details = String(data.get("details") || "");
    const to = form.getAttribute("data-email") || "";
    const body = [`Name: ${name}`, `Company: ${company}`, `Budget (USD): ${budget}`, `Email: ${email}`, "", details].join("\n");
    const url = `mailto:${to}?subject=${encodeURIComponent(`Project inquiry from ${name || "portfolio"}`)}&body=${encodeURIComponent(body)}`;
    const note = form.querySelector("[data-form-note]");
    if (note) note.textContent = "Opening your email app with this message.";
    window.location.href = url;
  });
}

function initFeaturedRows() {
  const grid = document.querySelector(".featured-grid");
  const anchor = grid?.querySelector(".place-vis");
  if (!grid || !anchor) return;
  const desktop = window.matchMedia("(min-width: 1101px)");
  const apply = () => {
    grid.style.gridTemplateRows = "";
    if (!desktop.matches) return;
    const height = Math.round(anchor.getBoundingClientRect().height);
    if (height > 0) grid.style.gridTemplateRows = `${height}px ${height}px`;
  };
  apply();
  desktop.addEventListener("change", apply);
  window.addEventListener("resize", apply);
  grid.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", apply, { once: true });
  });
}

initCursor();
initDock();
initReveal();
initFeaturedRows();
initFilters();
initForm();
