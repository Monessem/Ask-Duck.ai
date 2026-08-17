import { applyTheme } from '../utils/theme.js';
import { applyDocumentDirection, t } from '../utils/i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
  applyDocumentDirection();
  await applyTheme(document.documentElement);
  localizePage();

  document.getElementById('open-settings').addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });
});

function localizePage() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
}
