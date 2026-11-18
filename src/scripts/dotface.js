// Port of the handoff demo renderer. Pose choice, easing, and dot drawing
// follow that file. The page canvas is transparent and sized to its slot.

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NEIGHBOR = 0.32;
const BLEND_K = 2.4;

let loading = null;
let anim = null;
const instances = [];
let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let last = 0;
let raf = 0;
let listening = false;

function decodeBits(b64, nBits) {
  const raw = atob(b64);
  const bits = new Uint8Array(nBits);
  for (let i = 0; i < nBits; i++) {
    const byte = raw.charCodeAt(i >> 3);
    bits[i] = (byte >> (7 - (i & 7))) & 1;
  }
  return bits;
}

function prepare(data) {
  if (!data || anim === data) return data;
  const nBits = data.rows * data.cols;
  for (const frame of data.frames) {
    if (!frame._dots) frame._dots = decodeBits(frame.dots, nBits);
  }
  anim = data;
  return data;
}

function loadData(url) {
  if (!loading) {
    const posesUrl = url.replace(/frames\.js(\?.*)?$/, "poses.json");
    loading = (async () => {
      if (!window.DOTFACE_ANIM) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = url;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("dotface frames failed"));
          document.head.appendChild(script);
        });
      }
      if (!window.DOTFACE_ANIM) throw new Error("dotface frames missing");
      const data = prepare(window.DOTFACE_ANIM);
      const poses = await fetch(posesUrl).then((response) => {
        if (!response.ok) throw new Error("dotface poses failed");
        return response.json();
      });
      const list = Array.isArray(poses)
        ? poses
        : Object.keys(poses)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => poses[key]);
      data.frames.forEach((frame, index) => {
        const pose = list[index];
        frame._gx = pose?.grid_x ?? 0;
        frame._gy = pose?.grid_y ?? 0;
      });
      return data;
    })();
  }
  return loading;
}

function nearestTwo(frames, gx, gy) {
  let i1 = 0;
  let i2 = 0;
  let d1 = Infinity;
  let d2 = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = Math.hypot((frames[i]._gx ?? 0) - gx, (frames[i]._gy ?? 0) - gy);
    if (d < d1) {
      d2 = d1;
      i2 = i1;
      d1 = d;
      i1 = i;
    } else if (d < d2) {
      d2 = d;
      i2 = i;
    }
  }
  return [i1, i2, d1, d2];
}

function poseDist(a, b) {
  return Math.hypot((a._gx ?? 0) - (b._gx ?? 0), (a._gy ?? 0) - (b._gy ?? 0));
}

function metrics(data, disp) {
  const dpr = disp > 520 ? 1 : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const scale = (disp * dpr) / data.canvas;
  return {
    dpr,
    width: Math.max(1, Math.round(disp * dpr)),
    height: Math.max(1, Math.round(disp * dpr)),
    scale,
    rDot: Math.max(0.7, 0.5 * data.dot_diameter * scale),
    cx0: data.origin_x * scale,
    cy0: data.origin_y * scale,
    dx: data.dx * scale,
    dy: data.dy * scale,
  };
}

function paintPose(oc, data, frame, m) {
  oc.width = m.width;
  oc.height = m.height;
  const ctx = oc.getContext("2d", { alpha: true });
  ctx.clearRect(0, 0, oc.width, oc.height);
  ctx.fillStyle = "#000";
  const bits = frame._dots;
  let batch = 0;
  ctx.beginPath();
  for (let i = 0; i < data.rows; i++) {
    const y = m.cy0 + i * m.dy;
    const row = i * data.cols;
    for (let j = 0; j < data.cols; j++) {
      if (!bits[row + j]) continue;
      const x = m.cx0 + j * m.dx;
      ctx.moveTo(x + m.rDot, y);
      ctx.arc(x, y, m.rDot, 0, Math.PI * 2);
      if (++batch === 1500) {
        ctx.fill();
        ctx.beginPath();
        batch = 0;
      }
    }
  }
  ctx.fill();
}

function frontIndex(data) {
  const frames = data.frames;
  let best = 0;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].name === "front" || (frames[i].yaw === 0 && frames[i].pitch === 0)) return i;
  }
  return best;
}

export function frontPlate(px) {
  const node = document.querySelector("[data-dotface]");
  const url = node?.dataset.frames;
  if (!url) return Promise.reject(new Error("dotface url missing"));
  return loadData(url).then((data) => {
    const plate = document.createElement("canvas");
    paintPose(plate, data, data.frames[frontIndex(data)], metrics(data, px));
    return plate;
  });
}

function drawInstance(inst) {
  const canvas = inst.canvas;
  if (!canvas.isConnected || !canvas.width || !canvas.clientWidth) return;
  const data = inst.data;
  const [i1, i2, d1, d2] = nearestTwo(data.frames, inst.curX, inst.curY);
  const primary = inst.off[i1].width ? i1 : frontIndex(data);
  if (!inst.off[primary].width) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(inst.off[primary], 0, 0);
  if (reduce || !inst.ready || primary !== i1) return;
  const pairD = poseDist(data.frames[i1], data.frames[i2]);
  if (pairD > 1e-6 && pairD < NEIGHBOR && inst.off[i2].width) {
    const w1 = 1 / Math.pow(d1 + 1e-5, BLEND_K);
    const w2 = 1 / Math.pow(d2 + 1e-5, BLEND_K);
    const a2 = w2 / (w1 + w2);
    if (a2 > 0.06 && a2 < 0.94) {
      ctx.globalAlpha = a2;
      ctx.drawImage(inst.off[i2], 0, 0);
      ctx.globalAlpha = 1;
    }
  }
}

function release(inst) {
  for (const oc of inst.off) {
    oc.width = 0;
    oc.height = 0;
  }
  inst.ready = false;
  inst.key = "";
}

async function prerender(inst) {
  const canvas = inst.canvas;
  const disp = canvas.clientWidth;
  if (!disp) {
    if (inst.key) release(inst);
    return;
  }
  const data = inst.data;
  const m = metrics(data, disp);
  const key = `${m.width}x${m.height}`;
  if (inst.key === key && inst.ready) return;
  const token = ++inst.token;
  inst.key = key;
  inst.ready = false;
  canvas.width = m.width;
  canvas.height = m.height;
  if (reduce) {
    paintPose(inst.off[frontIndex(data)] || inst.off[0], data, data.frames[frontIndex(data)], m);
    if (inst.token !== token) return;
    inst.ready = true;
    inst.curX = 0;
    inst.curY = 0;
    drawInstance(inst);
    return;
  }
  for (let fi = 0; fi < data.frames.length; fi++) {
    if (inst.token !== token) return;
    paintPose(inst.off[fi], data, data.frames[fi], m);
    if (fi === frontIndex(data)) drawInstance(inst);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (inst.token !== token) return;
  inst.ready = true;
  drawInstance(inst);
}

function onPtr(event) {
  pointerX = event.clientX;
  pointerY = event.clientY;
}

function gridTarget(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  const x = ((pointerX - rect.left) / width) * 2 - 1;
  const y = 1 - ((pointerY - rect.top) / height) * 2;
  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(-1, Math.min(1, y)),
  };
}

function tick(now) {
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
  last = now;
  const ease = 1 - Math.exp(-dt / 0.14);
  for (const inst of instances) {
    const canvas = inst.canvas;
    if (!canvas.isConnected || !canvas.clientWidth) continue;
    const goal = gridTarget(canvas);
    inst.curX += (goal.x - inst.curX) * ease;
    inst.curY += (goal.y - inst.curY) * ease;
    drawInstance(inst);
  }
  raf = requestAnimationFrame(tick);
}

function mount() {
  const nodes = [...document.querySelectorAll("canvas[data-dotface]")];
  if (!nodes.length) return;
  const url = nodes.find((node) => node.dataset.frames)?.dataset.frames;
  if (!url) return;
  loadData(url)
    .then((data) => {
      for (const canvas of nodes) {
        if (instances.some((inst) => inst.canvas === canvas)) continue;
        const inst = {
          canvas,
          data,
          off: data.frames.map(() => document.createElement("canvas")),
          ready: false,
          key: "",
          token: 0,
          curX: 0,
          curY: 0,
        };
        instances.push(inst);
        const watch = () => {
          prerender(inst);
        };
        if (typeof ResizeObserver !== "undefined") new ResizeObserver(watch).observe(canvas);
        window.addEventListener("resize", watch);
        watch();
      }
      if (reduce || listening) return;
      listening = true;
      window.addEventListener("pointermove", onPtr, { capture: true, passive: true });
      last = performance.now();
      raf = requestAnimationFrame(tick);
    })
    .catch(() => {});
}

mount();
