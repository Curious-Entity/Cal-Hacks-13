import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newGame, getChoices, takeAction, getView, inspectObject } from '../public/story.js';
import { chinese } from '../public/locales/zh-CN.js';

// A fresh module represents loading a new chapter/page with a saved preference.
async function languageModule(stored, storageFails = false) {
  globalThis.localStorage = { getItem(key) {
    assert.equal(key, 'last-light-language');
    if (storageFails) throw new Error('Storage disabled');
    return stored;
  } };
  try { return await import(`../public/i18n.js?test=${Math.random()}`); }
  finally { delete globalThis.localStorage; }
}

test('English is the default, including invalid preferences and unavailable storage', async () => {
  for (const value of [null, 'en', 'unexpected']) {
    const { t } = await languageModule(value);
    assert.equal(t('Begin my adventure'), 'Begin my adventure');
  }
  const { t } = await languageModule(null, true);
  assert.equal(t('Begin my adventure'), 'Begin my adventure');
});

test('saved Chinese preference localizes templates while preserving interpolated story text', async () => {
  const { t } = await languageModule('zh-CN');
  assert.equal(t('Begin my adventure'), '开始我的冒险');
  assert.equal(t('✧ You chose: {0}', 'Trust your partner'), '✧ 你的选择：Trust your partner');
  assert.equal(t('An unknown server message'), 'An unknown server message');
});

test('authored train choices, narration, memories, and inspections have Chinese translations', () => {
  function visit(state) {
    const view = getView(state);
    for (const copy of [view.label, view.prompt, view.status, view.location, view.hint, ...view.title.split('\n'), ...view.paragraphs, ...state.memories, ...state.inventory, view.endingTitle].filter(Boolean)) {
      assert.ok(chinese[copy], copy);
    }
    for (const target of ['mara', 'eli', 'photograph', 'radio']) {
      const inspection = inspectObject(state, target);
      for (const copy of [inspection.label, ...inspection.paragraphs, inspection.actionLabel].filter(Boolean)) assert.ok(chinese[copy], copy);
    }
    for (const choice of getChoices(state)) {
      assert.ok(chinese[choice.label], choice.label);
      assert.ok(chinese[choice.hint], choice.hint);
      visit(takeAction(state, choice.id));
    }
  }
  visit(newGame());
});

test('both interfaces expose the shared language control and preserve API content boundaries', async () => {
  for (const name of ['adventure', 'sample']) {
    const html = await readFile(new URL(`../public/${name}.html`, import.meta.url), 'utf8');
    assert.equal((html.match(/id="language-toggle"/g) || []).length, 1);
    assert.ok(html.includes('data-language="en"'));
    assert.ok(html.includes('data-language="zh-CN"'));
    assert.ok(html.indexOf('id="language-toggle"') > html.indexOf('</nav>'));
  }
  const html = await readFile(new URL('../public/adventure.html', import.meta.url), 'utf8');
  for (const id of ['generated-narration', 'adventure-title', 'generated-location', 'object-description', 'object-clue']) {
    assert.ok(html.includes(`data-story-content id="${id}"`), id);
  }
});
