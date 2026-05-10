import { processImage } from './processor.js';
import { renderSlides } from './renderer.js';
import { exportZip, exportPptx } from './exports.js';
import { setupLoader } from './loader.js';

// --- State ---
let loadedImage = null;
let chunks = [];

// --- DOM ---
const el = id => document.getElementById(id);

const dropzone       = el('dropzone');
const fileInput      = el('fileInput');
const btnProcess     = el('btnProcess');
const btnZip         = el('btnZip');
const btnPptx        = el('btnPptx');
const statusEl       = el('status');
const titleHintEl    = el('titleHint');
const thresholdInput = el('threshold');
const thresholdVal   = el('thresholdVal');
const titleAutoCheck = el('titleAuto');
const titleManualRow = el('titleManualRow');

// --- Settings controls ---
thresholdInput.addEventListener('input', () => {
  thresholdVal.textContent = thresholdInput.value;
});

titleAutoCheck.addEventListener('change', () => {
  titleManualRow.style.display = titleAutoCheck.checked ? 'none' : 'flex';
});

// --- Image loader ---
setupLoader(dropzone, fileInput, (img, name) => {
  loadedImage = img;
  setDropzoneLoaded(name, img.width, img.height);
  btnProcess.disabled = false;
  setStatus('');
  setTitleHint('pending');
});

// --- Process ---
btnProcess.addEventListener('click', async () => {
  if (!loadedImage) return;
  btnProcess.disabled = true;
  setStatus('Bezig met verwerken…');

  try {
    chunks = await processImage(loadedImage, readSettings());

    if (!chunks.length) {
      setStatus('Geen notenbalken gevonden. Pas de instellingen aan en probeer opnieuw.', 'error');
      setTitleHint('none');
      return;
    }

    setTitleHint(chunks[0]?.hasTitle ? 'found' : 'none');
    renderSlides(chunks, {
      listEl:    el('slideList'),
      titleEl:   el('slidesTitle'),
      sectionEl: el('slidesSection'),
      bannerEl:  el('instructionBanner'),
    });
    btnZip.disabled = false;
    btnPptx.disabled = false;
    setStatus(`${chunks.length} slides verwerkt.`, 'success');
  } catch ({ message }) {
    setStatus(`Fout bij verwerken: ${message}`, 'error');
  } finally {
    btnProcess.disabled = false;
  }
});

// --- ZIP export ---
btnZip.addEventListener('click', async () => {
  btnZip.disabled = true;
  setStatus('ZIP aanmaken…');
  try {
    await exportZip(chunks, filename());
    setStatus('ZIP gedownload.', 'success');
  } catch ({ message }) {
    setStatus(`Fout bij ZIP export: ${message}`, 'error');
  } finally {
    btnZip.disabled = false;
  }
});

// --- PPTX export ---
btnPptx.addEventListener('click', async () => {
  btnPptx.disabled = true;
  setStatus('PowerPoint aanmaken…');
  try {
    await exportPptx(chunks, filename());
    setStatus('PowerPoint geëxporteerd.', 'success');
  } catch ({ message }) {
    setStatus(`Fout bij PowerPoint export: ${message}`, 'error');
  } finally {
    btnPptx.disabled = false;
  }
});

// --- Helpers ---
function readSettings() {
  return {
    linesPerSlide: parseInt(el('linesPerSlide').value) || 4,
    threshold:     parseInt(thresholdInput.value) || 12,
    minGap:        parseInt(el('minGap').value) || 6,
    titleAuto:     titleAutoCheck.checked,
    titleManualPx: parseInt(el('titleManualPx').value) || 80,
  };
}

function filename() {
  return el('filename').value.trim() || 'bladmuziek';
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = `status${type ? ` ${type}` : ''}`;
}

function setDropzoneLoaded(name, w, h) {
  dropzone.classList.add('loaded');
  el('dropzoneIcon').className = 'ti ti-circle-check';
  el('dropzoneMain').textContent = name;
  el('dropzoneSub').textContent = '';
  el('dropzoneInfo').textContent = `${w} × ${h} px`;
}

const TITLE_HINTS = {
  pending: { text: 'Verwerk de afbeelding om de titelzone te detecteren.',     cls: '' },
  found:   { text: 'Titelzone gedetecteerd en samengevoegd met slide 1.',       cls: 'detected' },
  none:    { text: 'Geen aparte titelzone gedetecteerd.',                       cls: '' },
};

function setTitleHint(state) {
  const { text, cls } = TITLE_HINTS[state] ?? TITLE_HINTS.pending;
  titleHintEl.textContent = text;
  titleHintEl.className = `hint-text${cls ? ` ${cls}` : ''}`;
}
