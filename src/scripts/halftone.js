import { ACCENT, GLYPHS, hash, rasterTextCells, strokeOrder } from "./grid.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const LOOP_MS = 2600;

if (!reduce) {
  const links = [...document.querySelectorAll(".halftone")];
  const states = new Map();
  let raf = 0;

  const ensure = (link) => {
    let state = states.get(link);
    if (state) return state;
    const dots = document.createElement("canvas");
    dots.className = "halftone-dots";
    dots.setAttribute("aria-hidden", "true");
    link.append(dots);
    state = { dots, cells: [], path: [], cell: 8, built: "" };
    states.set(link, state);
    return state;
  };

  const tick = (now) => {
    let live = false;
    for (const link of links) {
      if (!link.classList.contains("is-on")) continue;
      live = true;
      draw(link, ensure(link), now);
    }
    raf = live ? requestAnimationFrame(tick) : 0;
  };

  const arm = (link) => {
    const state = ensure(link);
    build(link, state);
    link.classList.add("is-on");
    if (!raf) raf = requestAnimationFrame(tick);
  };

  for (const link of links) {
    link.addEventListener("pointerenter", () => arm(link));
    link.addEventListener("pointerleave", () => link.classList.remove("is-on"));
  }

  window.addEventListener("resize", () => {
    for (const state of states.values()) state.built = "";
  });
}

function build(link, state) {
  const label = link.querySelector(".halftone-label");
  if (!label) return;
  const cs = getComputedStyle(label);
  const font = `400 ${cs.fontSize} "Pixelify Sans", ${cs.fontFamily}`;
  const width = Math.max(1, link.clientWidth);
  const height = Math.max(1, link.clientHeight);
  const key = `${font}|${label.textContent}|${width}x${height}`;
  if (state.built === key && state.cells.length) return;
  state.built = key;
  const fontSize = parseFloat(cs.fontSize) || 48;
  const cell = Math.max(6, Math.round(fontSize / 11));
  state.cell = cell;
  state.dots.width = width;
  state.dots.height = height;
  state.dots.style.width = `${width}px`;
  state.dots.style.height = `${height}px`;
  state.cells = rasterTextCells(label.textContent || "", font, width, height, cell);
  state.path = strokeOrder(state.cells);
}

function draw(link, state, now) {
  if (!state.cells.length) build(link, state);
  const dots = state.dots.getContext("2d");
  const width = link.clientWidth;
  const height = link.clientHeight;
  dots.clearRect(0, 0, width, height);
  const { cells, path, cell } = state;
  if (!cells.length) return;
  const tick = Math.floor(now / 50);
  const span = Math.max(6, Math.round(path.length * 0.2));
  const head = (now / LOOP_MS) * path.length;
  const hot = new Map();
  for (let step = 0; step < span; step += 1) {
    const index = Math.floor(head - step + path.length * 8) % path.length;
    hot.set(`${path[index].x},${path[index].y}`, 1 - step / span);
  }
  dots.textAlign = "center";
  dots.textBaseline = "middle";
  dots.font = `700 ${Math.max(8, cell - 1)}px ui-monospace, monospace`;
  const gap = 1;
  for (let i = 0; i < cells.length; i += 1) {
    const item = cells[i];
    const strength = hot.get(`${item.x},${item.y}`) || 0;
    if (strength > 0.35) {
      dots.fillStyle = "#ffd6ea";
      dots.fillRect(item.x, item.y, cell, cell);
      dots.fillStyle = ACCENT;
      dots.fillRect(item.x, item.y, cell - gap, cell - gap);
      continue;
    }
    const n = hash(i + 1, tick);
    const scramble = n % 9 === 0 || (strength > 0 && n % 3 === 0);
    if (scramble) {
      dots.fillStyle = strength > 0 ? ACCENT : "#141414";
      const jx = (n % 3) - 1;
      const jy = (hash(i + 3, tick) % 3) - 1;
      dots.fillText(GLYPHS[n % GLYPHS.length], item.x + cell / 2 + jx, item.y + cell / 2 + jy);
      continue;
    }
    dots.fillStyle = "#141414";
    dots.fillRect(item.x, item.y, cell - gap, cell - gap);
  }
}
