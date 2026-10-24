import { chinese } from './locales/zh-CN.js';

const STORAGE_KEY = 'last-light-language';
let language = 'en';
try {
  if (localStorage.getItem(STORAGE_KEY) === 'zh-CN') language = 'zh-CN';
} catch { /* Language switching still works if browser storage is disabled. */ }

export const getLanguage = () => language;

export function t(source, ...values) {
  const template = language === 'zh-CN' ? chinese[source] || source : source;
  return template.replace(/\{(\d+)\}/g, (_, index) => values[index] ?? `{${index}}`);
}

// Only these UI templates contain variable text. Story containers are excluded below.
const templates = [
  ['SCENE {0} OF 05 · {1}', /^SCENE (\d+) OF 05 · (.+)$/],
  ['{0} must contain {1}–{2} characters.', /^(.+) must contain (\d+)–(\d+) characters\.$/],
  ['Invalid {0}.', /^Invalid (.+)\.$/],
  ['{0} decisions · {1} discoveries', /^(\d+) decisions · (\d+) discoveries$/],
];
function translate(source) {
  if (language === 'en') return source;
  if (chinese[source]) return chinese[source];
  for (const [key, pattern] of templates) {
    const match = source.match(pattern);
    if (match) return t(key, ...match.slice(1).map(value => chinese[value] || value));
  }
  // Provider and frequency text are composed by the existing setup UI.
  const suffix = ' Paint only when you ask, or once per scene. Saved images are reused.';
  if (source.endsWith(suffix)) return translate(source.slice(0, -suffix.length)) + ' ' + t(suffix.trim());
  return source;
}

export function initLanguage() {
  const button = document.querySelector('#language-toggle');
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const attributeNames = ['aria-label', 'title', 'placeholder', 'alt'];

  const fields = [...document.querySelectorAll('input, textarea, select')];
  function validateField(field) {
    field.setCustomValidity('');
    if (field.validity.valueMissing) field.setCustomValidity(t('Please fill out this field.'));
    else if (field.validity.tooShort) field.setCustomValidity(t('Please use at least {0} characters.', field.minLength));
  }
  for (const field of fields) {
    field.addEventListener('invalid', () => validateField(field));
    field.addEventListener('input', () => field.setCustomValidity(''));
  }

  // Remember the English source on each node so switching back never loses copy.
  // Observe UI updates (loading, errors, dialogs) without touching game state.
  function update() {
    observer.disconnect();
    document.documentElement.lang = language;
    for (const field of fields) if (field.validity.customError) validateField(field);
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('script, style, [data-story-content], #language-toggle')) continue;
      const previous = originals.get(node);
      const source = previous?.rendered === node.nodeValue ? previous.source : node.nodeValue;
      const trimmed = source.trim();
      const rendered = trimmed ? source.replace(trimmed, () => translate(trimmed)) : source;
      if (node.nodeValue !== rendered) node.nodeValue = rendered;
      originals.set(node, { source, rendered });
    }
    for (const node of document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
      if (node.closest('#language-toggle, [data-story-content], [data-story-attribute]')) continue;
      const record = attributes.get(node) || {};
      for (const name of attributeNames) {
        if (!node.hasAttribute(name)) continue;
        const current = node.getAttribute(name);
        const source = record[name]?.rendered === current ? record[name].source : current;
        const rendered = translate(source);
        if (current !== rendered) node.setAttribute(name, rendered);
        record[name] = { source, rendered };
      }
      attributes.set(node, record);
    }
    button.setAttribute('aria-label', t('Language'));
    for (const option of button.querySelectorAll('[data-language]')) {
      option.setAttribute('aria-pressed', String(option.dataset.language === language));
    }
    observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributeNames });
  }
  const observer = new MutationObserver(update);
  function selectLanguage(next, persist = true) {
    if (!['en', 'zh-CN'].includes(next)) return;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* In-memory fallback. */ }
    }
    if (language !== next) {
      language = next;
      window.dispatchEvent(new Event('languagechange'));
    }
    update();
  }
  for (const option of button.querySelectorAll('[data-language]')) {
    option.addEventListener('click', () => selectLanguage(option.dataset.language));
  }
  // Restore the latest preference when returning through the browser's page cache.
  window.addEventListener('pageshow', () => {
    try { selectLanguage(localStorage.getItem(STORAGE_KEY), false); } catch { /* Storage disabled. */ }
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) selectLanguage(event.newValue || 'en', false);
  });
  update();
}
