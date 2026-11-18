import { GLYPHS, hash } from "./grid.js";
import { frontPlate } from "./dotface.js";

const STAGE_W = 1440;
const STAGE_H = 1024;
const SEEN_KEY = "angela-intro-seen";
const SCRIBBLE_MS = 400;
const SCRIBBLE_GAP_MS = 36;
const GLITCH_MS = 1450;
const HOLD_MS = 420;
const SHRINK_MS = 1400;
const REVEAL_MS = 860;
const MOVE_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const SCRIBBLE_CELL = 8;
const GLITCH_CELL = 16;
const SCRIBBLE = "#ff0066";
const INK = "#000";

const root = document.documentElement;
const opener = document.querySelector("[data-opener]");

if (root.classList.contains("intro-pending") && opener && !opener.dataset.booted) {
  opener.dataset.booted = "1";
  boot(opener);
}

function boot(openerEl) {
  const stage = openerEl.querySelector("[data-opener-stage]");
  const canvas = openerEl.querySelector("[data-opener-canvas]");
  const face = openerEl.querySelector(".opener-face");
  const nameEl = openerEl.querySelector("[data-opener-name]");
  const scriptEl = openerEl.querySelector("[data-opener-script]");
  const homeFace = document.querySelector(".home-face");
  const homeName = document.querySelector("[data-home-name]");
  if (!stage || !canvas || !face || !nameEl || !scriptEl || !homeFace || !homeName) {
    root.classList.remove("intro-pending", "intro-arriving", "intro-settling", "intro-reveal");
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  const ac = new AbortController();
  let finished = false;

  const settle = () => {
    if (finished) return;
    finished = true;
    ac.abort();
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
    root.classList.remove("intro-pending", "intro-arriving", "intro-settling", "intro-reveal");
    root.style.overflow = "";
    document.body.style.overflow = "";
    openerEl.style.display = "none";
  };

  if (!ctx) {
    settle();
    return;
  }

  const fit = () => {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = `scale(${scale})`;
  };

  const skip = () => settle();

  document.body.dataset.introLive = "1";
  window.addEventListener("keydown", skip);
  window.addEventListener("pointerdown", skip);
  window.addEventListener("wheel", skip, { passive: true });
  window.addEventListener("touchmove", skip, { passive: true });
  window.addEventListener("resize", fit);
  root.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);
  fit();

  const safety = window.setTimeout(settle, 12000);

  play().finally(() => {
    window.clearTimeout(safety);
    window.removeEventListener("keydown", skip);
    window.removeEventListener("pointerdown", skip);
    window.removeEventListener("wheel", skip);
    window.removeEventListener("touchmove", skip);
    window.removeEventListener("resize", fit);
  });

  async function play() {
    try {
      const names = (openerEl.dataset.names || "").split("|").filter(Boolean);
      const facePromise = frontPlate(912);
      const [nameImgs, scriptImg] = await Promise.all([
        Promise.all(names.map(loadImage)),
        loadImage(openerEl.dataset.script || scriptEl.getAttribute("src") || ""),
        document.fonts.load('400 175px Tangents').catch(() => []),
        document.fonts.load('400 175px "Pixelify Sans"').catch(() => []),
        document.fonts.ready,
      ]);
      if (ac.signal.aborted) return;

      const scratch = document.createElement("canvas");
      scratch.width = STAGE_W;
      scratch.height = STAGE_H;
      const sctx = scratch.getContext("2d", { willReadFrequently: true });
      if (!sctx) {
        settle();
        return;
      }

      for (let index = 0; index < nameImgs.length; index++) {
        if (ac.signal.aborted) return;
        const img = nameImgs[index];
        const placed = placeName(img);
        const cells = occupiedCells(sctx, (g) => g.drawImage(img, placed.x, placed.y, placed.w, placed.h), SCRIBBLE_CELL, 2);
        if (!cells.length) {
          ctx.clearRect(0, 0, STAGE_W, STAGE_H);
          ctx.drawImage(img, placed.x, placed.y, placed.w, placed.h);
          await wait(SCRIBBLE_MS, ac.signal);
        } else {
          await frames(SCRIBBLE_MS, ac.signal, (t, elapsed) => {
            drawScribble(ctx, cells, img, placed, t, elapsed);
          });
        }
        if (ac.signal.aborted) return;
        if (index < nameImgs.length - 1) {
          ctx.clearRect(0, 0, STAGE_W, STAGE_H);
          await wait(SCRIBBLE_GAP_MS, ac.signal);
        }
      }

      if (ac.signal.aborted) return;
      const plate = document.createElement("canvas");
      plate.width = STAGE_W;
      plate.height = STAGE_H;
      const pctx = plate.getContext("2d");
      if (!pctx) {
        settle();
        return;
      }
      const faceImg = await facePromise;
      paintFinal(pctx, faceImg, scriptImg, nameEl);
      const cells = buildGlitchCells(sctx, (g) => g.drawImage(plate, 0, 0), 5);
      await frames(GLITCH_MS, ac.signal, (t) => {
        drawGlitch(ctx, cells, plate, t);
      });
      if (ac.signal.aborted) return;

      openerEl.classList.add("is-final");
      await wait(HOLD_MS, ac.signal);
      if (ac.signal.aborted) return;

      await shrink(stage, face, nameEl, scriptEl, homeFace, homeName, ac.signal);
      if (ac.signal.aborted) return;
      settle();
    } catch {
      settle();
    }
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });
}

function placeName(img) {
  const width = 1080;
  const nw = img.naturalWidth || 1134;
  const nh = img.naturalHeight || 206;
  const height = width * (nh / nw);
  return {
    x: (STAGE_W - width) / 2,
    y: 462 - height / 2,
    w: width,
    h: height,
  };
}

function occupiedCells(sctx, draw, cellSize, minHits) {
  sctx.clearRect(0, 0, STAGE_W, STAGE_H);
  draw(sctx);
  const image = sctx.getImageData(0, 0, STAGE_W, STAGE_H);
  const data = image.data;
  const cells = [];
  for (let y = 0; y < STAGE_H; y += cellSize) {
    for (let x = 0; x < STAGE_W; x += cellSize) {
      let hits = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let py = y; py < y + cellSize && py < STAGE_H; py += 2) {
        for (let px = x; px < x + cellSize && px < STAGE_W; px += 2) {
          const i = (py * STAGE_W + px) * 4;
          const alpha = data[i + 3];
          if (alpha < 40) continue;
          const ink = 255 * 3 - data[i] - data[i + 1] - data[i + 2];
          if (ink < 70) continue;
          hits += 1;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
      }
      if (hits >= minHits) {
        const ar = r / hits;
        const ag = g / hits;
        const ab = b / hits;
        const pink = ar > 170 && ag < 120 && ab < 170;
        cells.push({ x, y, color: pink ? SCRIBBLE : INK });
      }
    }
  }
  return cells;
}

function paintFinal(ctx, faceImg, scriptImg, nameEl) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.drawImage(faceImg, 264, 56, 912, 912);
  const size = parseFloat(getComputedStyle(nameEl).fontSize) || 175.2;
  const slot = nameEl.parentElement;
  const top = slot ? parseFloat(getComputedStyle(slot).top) || 378 : 378;
  ctx.fillStyle = INK;
  ctx.font = `400 ${size}px Tangents, "Pixelify Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.letterSpacing = "0px";
  ctx.fillText(nameEl.textContent || "angela lau.", STAGE_W / 2, top);
  ctx.drawImage(scriptImg, 570, 544, 299, 61);
}

function buildGlitchCells(sctx, draw, minHits) {
  const cells = occupiedCells(sctx, draw, GLITCH_CELL, minHits);
  const sliceH = GLITCH_CELL * 3;
  return cells.map((cell, index) => {
    const slice = Math.floor(cell.y / sliceH);
    let sliceX = (hash(slice, 3) % 140) - 70;
    const sliceY = ((hash(slice, 9) % 18) - 9) * (slice % 2 === 0 ? 1 : -1);
    if (slice % 4 === 1 && cell.x < STAGE_W / 2) sliceX *= -0.7;
    const chunkCol = Math.floor(cell.x / (GLITCH_CELL * 4));
    const chunkRow = Math.floor(cell.y / (GLITCH_CELL * 4));
    const chunk = hash(chunkCol + 1, chunkRow + 3);
    return {
      ...cell,
      sliceX,
      sliceY,
      chunkX: (chunk % 56) - 28,
      chunkY: (hash(chunk, 4) % 28) - 14,
      seed: hash(index + 1, 7),
    };
  });
}

function drawScribble(ctx, cells, img, placed, t, elapsed) {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  const tick = Math.floor(elapsed / 45);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${SCRIBBLE_CELL}px ui-monospace, monospace`;
  ctx.fillStyle = SCRIBBLE;
  const resolve = t > 0.68;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const n = hash(i + 1, tick);
    if (!resolve && n % 100 < 18) continue;
    if (resolve && n % 100 < Math.floor((t - 0.68) * 200)) continue;
    const jx = (n % 5) - 2;
    const jy = (hash(i + 1, tick + 2) % 5) - 2;
    ctx.fillText(GLYPHS[n % GLYPHS.length], cell.x + SCRIBBLE_CELL / 2 + jx, cell.y + SCRIBBLE_CELL / 2 + jy);
  }
  if (t > 0.62) {
    ctx.globalAlpha = Math.min(1, (t - 0.62) / 0.22);
    ctx.drawImage(img, placed.x, placed.y, placed.w, placed.h);
    ctx.globalAlpha = 1;
  }
}

function chaosAt(t) {
  if (t < 0.1) return 1;
  if (t < 0.28) return 0.78;
  if (t < 0.48) return 0.62 + Math.sin(((t - 0.28) / 0.2) * Math.PI) * 0.28;
  const u = (t - 0.48) / 0.52;
  return Math.max(0, 0.5 * (1 - u) * (1 - u));
}

function drawGlitch(ctx, cells, plate, t) {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  const chaos = chaosAt(t);
  const tick = Math.floor(t * 28);
  const gap = 1.25 + chaos * 1.1;
  const size = GLITCH_CELL - gap;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${GLITCH_CELL - 3}px ui-monospace, monospace`;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const n = hash(cell.seed, tick + 1);
    const x = cell.x + (cell.sliceX + cell.chunkX) * chaos;
    const y = cell.y + (cell.sliceY + cell.chunkY) * chaos;
    const roll = (n % 1000) / 1000;
    ctx.fillStyle = cell.color;
    ctx.globalAlpha = 1;
    if (roll < chaos * 0.42) {
      ctx.globalAlpha = 0.9;
      const ox = x + (n % 7);
      const oy = y + (hash(n, 2) % 7);
      ctx.fillRect(ox, oy, 3, 3);
      if ((n & 2) === 0) ctx.fillRect(ox + 6, oy + 5, 3, 3);
      continue;
    }
    if (roll < chaos * 0.88) {
      ctx.fillText(GLYPHS[n % GLYPHS.length], x + GLITCH_CELL / 2, y + GLITCH_CELL / 2);
      continue;
    }
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
  if (t > 0.9) {
    ctx.globalAlpha = (t - 0.9) / 0.1;
    ctx.drawImage(plate, 0, 0);
    ctx.globalAlpha = 1;
  }
}

async function shrink(stage, face, nameEl, scriptEl, homeFace, homeName, signal) {
  const openerEl = stage.closest("[data-opener]");
  if (openerEl) openerEl.style.background = "transparent";
  stage.style.background = "transparent";
  root.classList.add("intro-settling");
  root.classList.remove("intro-pending");
  scriptEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: MOVE_EASE, fill: "forwards" });
  const stageScale = stage.getBoundingClientRect().width / STAGE_W || 1;
  const moves = [
    moveTo(face, homeFace.getBoundingClientRect(), stageScale),
    moveTo(nameEl, homeName.getBoundingClientRect(), stageScale),
  ];
  const running = moves.map((motion) =>
    motion.el.animate(motion.frames, {
      duration: SHRINK_MS,
      easing: MOVE_EASE,
      fill: "forwards",
    }),
  );
  await Promise.race([
    Promise.all(running.map((anim) => anim.finished.catch(() => {}))),
    wait(SHRINK_MS + 40, signal),
  ]);
  if (signal.aborted) {
    running.forEach((anim) => anim.cancel());
    return;
  }
  root.classList.add("intro-reveal");
  root.classList.remove("intro-settling");
  if (openerEl) openerEl.style.visibility = "hidden";
  await wait(REVEAL_MS, signal);
}

function moveTo(el, target, stageScale) {
  const start = el.getBoundingClientRect();
  const dx = (target.left - start.left) / stageScale;
  const dy = (target.top - start.top) / stageScale;
  const k = target.width / start.width || 1;
  el.style.transformOrigin = "top left";
  return {
    el,
    frames: [{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
  };
}

function frames(duration, signal, draw) {
  return new Promise((resolve) => {
    let raf = 0;
    const start = performance.now();
    const step = (now) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      draw(t, elapsed);
      if (t >= 1) resolve();
      else raf = requestAnimationFrame(step);
    };
    const onAbort = () => {
      cancelAnimationFrame(raf);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    raf = requestAnimationFrame(step);
  });
}

function wait(ms, signal) {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

