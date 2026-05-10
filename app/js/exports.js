import JSZip from 'jszip';

const SLIDE_WIDTH_IN  = 10;
const SLIDE_HEIGHT_IN = 5.625;

export async function exportZip(chunks, filename) {
  const zip = new JSZip();

  for (const [i, { blob }] of chunks.entries()) {
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${filename}-slides.zip`);
}

export async function exportPptx(chunks, filename) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';

  for (const chunk of chunks) {
    const slide = pres.addSlide();
    slide.background = { color: '000000' };

    const { x, y, w, h } = centerFit(chunk.imgW, chunk.imgH);
    slide.addImage({
      data: `image/png;base64,${chunk.b64}`,
      x, y, w, h,
      altText: `Bladmuziek slide ${chunk.idx + 1}`,
    });
  }

  await pres.writeFile({ fileName: `${filename}.pptx` });
}

function centerFit(imgW, imgH) {
  const ratio = imgW / imgH;
  const [SW, SH] = [SLIDE_WIDTH_IN, SLIDE_HEIGHT_IN];
  const [w, h] = ratio > SW / SH ? [SW, SW / ratio] : [SH * ratio, SH];
  return { x: (SW - w) / 2, y: (SH - h) / 2, w, h };
}

function triggerDownload(blob, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
}
