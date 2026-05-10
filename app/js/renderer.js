import { copyToClipboard } from './clipboard.js';

export function renderSlides(chunks, { listEl, titleEl, sectionEl, bannerEl }) {
  listEl.innerHTML = '';
  titleEl.textContent = `${chunks.length} slides klaar`;
  sectionEl.classList.add('visible');
  bannerEl.classList.add('visible');

  chunks.forEach(chunk => listEl.appendChild(createSlideRow(chunk)));
}

function createSlideRow(chunk) {
  const thumbUrl = URL.createObjectURL(chunk.blob);
  const row = document.createElement('div');
  row.className = `slide-row${chunk.hasTitle ? ' has-title' : ''}`;
  row.innerHTML = slideTemplate(chunk, thumbUrl);

  row.querySelector('.btn-copy').addEventListener('click', ({ currentTarget }) => {
    copyToClipboard(chunk.blob, currentTarget);
  });

  const dlLink = row.querySelector('.btn-download');
  dlLink.href = thumbUrl;

  return row;
}

function slideTemplate({ idx, lines, hasTitle }, thumbUrl) {
  const slideNum = idx + 1;
  const paddedNum = String(slideNum).padStart(2, '0');
  const lineLabel = `${lines} notenregel${lines !== 1 ? 's' : ''}`;
  const titleBadge = hasTitle
    ? '<span class="badge"><i class="ti ti-text-size"></i> incl. titel</span>'
    : '';

  return `
    <div class="slide-thumb">
      <img src="${thumbUrl}" alt="Slide ${slideNum}">
    </div>
    <div class="slide-info">
      <div class="slide-meta">
        <div class="slide-name">Slide ${slideNum}</div>
        <div class="slide-detail">${lineLabel}${titleBadge}</div>
      </div>
      <div class="slide-actions">
        <button class="btn btn-copy btn-sm">
          <i class="ti ti-copy"></i> Kopieer
        </button>
        <a class="btn btn-secondary btn-sm btn-download" download="slide-${paddedNum}.png">
          <i class="ti ti-download"></i> PNG
        </a>
      </div>
    </div>
  `;
}
