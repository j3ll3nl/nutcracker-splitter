const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

/**
 * @param {HTMLImageElement} img
 * @param {{ linesPerSlide: number, threshold: number, minGap: number, titleAuto: boolean, titleManualPx: number }} settings
 * @returns {Promise<Array>}
 */
export async function processImage(img, {
  linesPerSlide = 4,
  threshold = 12,
  minGap = 6,
  titleAuto = true,
  titleManualPx = 80,
} = {}) {
  const { width: W, height: H } = img;
  canvas.width = W;
  canvas.height = H;
  ctx.drawImage(img, 0, 0);

  const { data } = ctx.getImageData(0, 0, W, H);
  const rowBright = computeRowBrightness(data, W, H);
  const gaps = detectGaps(rowBright, H, threshold, minGap);
  const allZones = extractZones(gaps, H).filter(({ s, e }) => e - s >= 10);
  const titleBottom = resolveTitle(allZones, rowBright, threshold, titleAuto, titleManualPx);
  const staffZones = allZones.filter(({ s }) => s >= titleBottom);
  const groups = groupZones(staffZones, linesPerSlide, titleBottom);

  return Promise.all(groups.map((grp, idx) => cropGroup(img, grp, idx, W)));
}

function computeRowBrightness(data, W, H) {
  const rowBright = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    rowBright[y] = sum / W;
  }
  return rowBright;
}

function detectGaps(rowBright, H, threshold, minGap) {
  const gaps = [];
  let inGap = false;
  let gStart = 0;

  for (let y = 0; y < H; y++) {
    const dark = rowBright[y] < threshold;
    if (dark && !inGap) {
      inGap = true;
      gStart = y;
    } else if (!dark && inGap) {
      inGap = false;
      if (y - gStart >= minGap) gaps.push({ s: gStart, e: y - 1 });
    }
  }
  if (inGap && H - gStart >= minGap) gaps.push({ s: gStart, e: H - 1 });

  return gaps;
}

function extractZones(gaps, H) {
  const zones = [];
  let prev = 0;

  for (const { s, e } of gaps) {
    if (s > prev) zones.push({ s: prev, e: s - 1 });
    prev = e + 1;
  }
  if (prev < H) zones.push({ s: prev, e: H - 1 });

  return zones;
}

function staffScore(zone, rowBright, threshold) {
  let bright = 0;
  for (let y = zone.s; y <= zone.e; y++) {
    if (rowBright[y] > threshold + 10) bright++;
  }
  return bright / (zone.e - zone.s + 1);
}

function resolveTitle(allZones, rowBright, threshold, titleAuto, titleManualPx) {
  if (!titleAuto) return titleManualPx;
  if (allZones.length <= 1) return 0;

  const scores = allZones.map(z => staffScore(z, rowBright, threshold));
  const avgRest = scores.slice(1).reduce((a, b) => a + b, 0) / (scores.length - 1);

  return scores[0] < avgRest * 0.75 ? allZones[0].e + 1 : 0;
}

function groupZones(staffZones, linesPerSlide, titleBottom) {
  const groups = [];
  for (let i = 0; i < staffZones.length; i += linesPerSlide) {
    const slice = staffZones.slice(i, i + linesPerSlide);
    const hasTitle = i === 0 && titleBottom > 0;
    groups.push({
      top: hasTitle ? 0 : slice[0].s,
      bottom: slice.at(-1).e,
      lines: slice.length,
      hasTitle,
    });
  }
  return groups;
}

function cropGroup(img, { top, bottom, lines, hasTitle }, idx, W) {
  const h = bottom - top + 1;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = h;
  off.getContext('2d').drawImage(img, 0, top, W, h, 0, 0, W, h);

  return new Promise(resolve => {
    off.toBlob(blob => {
      const reader = new FileReader();
      reader.onload = ({ target }) => resolve({
        blob,
        idx,
        lines,
        hasTitle,
        b64: target.result.split(',')[1],
        imgW: W,
        imgH: h,
      });
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}
