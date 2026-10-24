import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { examples, localizeExampleValue } from '../public/examples.js';
import { chinese } from '../public/locales/zh-CN.js';

test('all supplied examples switch from English to Chinese and back, field by field', () => {
  for (const example of Object.values(examples)) {
    for (const field of ['premise', 'protagonist', 'details']) {
      assert.ok(example.en[field]);
      assert.ok(example['zh-CN'][field]);
      assert.notEqual(example.en[field], example['zh-CN'][field]);
      assert.equal(localizeExampleValue(field, example.en[field], 'zh-CN'), example['zh-CN'][field]);
      assert.equal(localizeExampleValue(field, example['zh-CN'][field], 'en'), example.en[field]);
      assert.equal(localizeExampleValue(field, example['zh-CN'][field], 'zh-CN'), example['zh-CN'][field]);
    }
  }
});

test('edited, cleared, and arbitrary player text stays exactly as written', () => {
  for (const example of Object.values(examples)) {
    for (const field of ['premise', 'protagonist', 'details']) {
      for (const value of ['', 'My own world', '我自己写的角色', example.en[field] + ' ', example['zh-CN'][field] + ' 我的修改']) {
        for (const language of ['en', 'zh-CN']) assert.equal(localizeExampleValue(field, value, language), value);
      }
    }
  }
  assert.equal(localizeExampleValue('protagonist', examples.ocean.en.premise, 'zh-CN'), examples.ocean.en.premise);
});

test('old drafts containing placeholder examples, including custom preferences, switch safely', async () => {
  const html = await readFile(new URL('../public/adventure.html', import.meta.url), 'utf8');
  for (const [id, field] of Object.entries({ premise:'premise', protagonist:'protagonist', 'story-details':'details', 'custom-mood':'customMood', 'custom-art-style':'customArtStyle' })) {
    const tag = html.match(new RegExp(`<[^>]+id="${id}"[^>]+>`))[0];
    const english = tag.match(/placeholder="([^"]+)"/)[1];
    assert.ok(chinese[english]);
    assert.equal(localizeExampleValue(field, english, 'zh-CN'), chinese[english]);
    assert.equal(localizeExampleValue(field, chinese[english], 'en'), english);
  }
});
