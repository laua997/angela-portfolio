export const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=/<>";
export const ACCENT = "#ff1493";
/** exclusion against white resolves to #ff1493 */
export const PINK_ON_WHITE = "#00eb6c";

export function hash(n, t) {
  let x = Math.imul(n + 1, 374761393) + Math.imul(t + 1, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Occupied square cells for a string drawn in `font` into a width×height box. */
export function rasterTextCells(text, font, width, height, cell) {
  const sample = document.createElement("canvas");
  sample.width = Math.max(1, width);
  sample.height = Math.max(1, height);
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, sample.width, sample.height);
  ctx.font = font;
  ctx.fillStyle = "#000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || parseFloat(font) * 0.8;
  const descent = metrics.actualBoundingBoxDescent || parseFloat(font) * 0.2;
  const y = (sample.height + ascent - descent) / 2;
  ctx.fillText(text, 0, y);
  const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
  const cells = [];
  const minHits = Math.max(1, Math.floor((cell * cell) / 12));
  for (let cy = 0; cy < sample.height; cy += cell) {
    for (let cx = 0; cx < sample.width; cx += cell) {
      let hits = 0;
      for (let py = cy; py < cy + cell && py < sample.height; py += 1) {
        for (let px = cx; px < cx + cell && px < sample.width; px += 1) {
          const i = (py * sample.width + px) * 4;
          const ink = 765 - data[i] - data[i + 1] - data[i + 2];
          if (data[i + 3] > 28 && ink > 60) hits += 1;
        }
      }
      if (hits >= minHits) cells.push({ x: cx, y: cy });
    }
  }
  return cells;
}

/** Snake through the cells so a window can travel along the letters. */
export function strokeOrder(cells) {
  const cols = new Map();
  for (const cell of cells) {
    const column = cols.get(cell.x) || [];
    column.push(cell);
    cols.set(cell.x, column);
  }
  const path = [];
  [...cols.keys()]
    .sort((a, b) => a - b)
    .forEach((x, index) => {
      const column = cols.get(x).sort((a, b) => a.y - b.y);
      if (index % 2) column.reverse();
      path.push(...column);
    });
  return path;
}
