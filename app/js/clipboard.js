const RESET_DELAY_MS = 2500;

export async function copyToClipboard(blob, btn) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    flashButton(btn, 'copied', '<i class="ti ti-check"></i> Gekopieerd!');
  } catch {
    flashButton(btn, null, '<i class="ti ti-x"></i> Niet beschikbaar');
  }
}

function flashButton(btn, cssClass, html) {
  const originalHtml = btn.innerHTML;
  if (cssClass) btn.classList.add(cssClass);
  btn.innerHTML = html;

  setTimeout(() => {
    if (cssClass) btn.classList.remove(cssClass);
    btn.innerHTML = originalHtml;
  }, RESET_DELAY_MS);
}
