import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, usernameFromInstagramUrl } from '../src/utils.js';
import { extractFromHtml, extractFromJsonNode } from '../src/export-parser.js';

test('normalizeUsername accepts valid usernames and normalizes case', () => {
  assert.equal(normalizeUsername('@Some.User_1'), 'some.user_1');
  assert.equal(normalizeUsername(' bad-name '), null);
});

test('usernameFromInstagramUrl extracts profile usernames only', () => {
  assert.equal(usernameFromInstagramUrl('https://www.instagram.com/Some.User/'), 'some.user');
  assert.equal(usernameFromInstagramUrl('https://instagram.com/accounts/login/'), null);
  assert.equal(usernameFromInstagramUrl('https://example.com/person/'), null);
});

test('extractFromJsonNode reads Meta string_list_data structures', () => {
  const users = extractFromJsonNode({
    relationships_following: [
      { string_list_data: [{ href: 'https://www.instagram.com/User.One/', value: 'User.One' }] },
      { string_list_data: [{ value: 'User_Two' }] },
    ],
  });
  assert.deepEqual([...users].sort(), ['user.one', 'user_two']);
});

test('extractFromHtml reads Instagram profile links', () => {
  const users = extractFromHtml('<a href="https://www.instagram.com/Alice/">Alice</a><a href="https://instagram.com/Bob_2/">Bob</a>');
  assert.deepEqual([...users].sort(), ['alice', 'bob_2']);
});
