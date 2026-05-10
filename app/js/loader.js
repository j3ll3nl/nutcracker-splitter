/**
 * @param {HTMLElement} dropzone
 * @param {HTMLInputElement} fileInput
 * @param {(img: HTMLImageElement, name: string) => void} onLoad
 */
export function setupLoader(dropzone, fileInput, onLoad) {
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    if (file) loadFromFile(file, onLoad);
    fileInput.value = '';
  });

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const [file] = e.dataTransfer.files;
    if (file) loadFromFile(file, onLoad);
  });

  document.addEventListener('paste', e => {
    const imageItem = [...(e.clipboardData?.items ?? [])].find(
      ({ type }) => type.startsWith('image/')
    );
    if (imageItem) loadFromFile(imageItem.getAsFile(), onLoad);
  });
}

function loadFromFile(file, onLoad) {
  if (!file?.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => onLoad(img, file.name ?? 'geplakte afbeelding');
  img.src = url;
}
