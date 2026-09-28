import fs from 'node:fs';
import { listFilesRecursive, normalizeUsername, usernameFromInstagramUrl } from './utils.js';

export function extractFromJsonNode(node, out = new Set()) {
  if (!node) return out;

  if (Array.isArray(node)) {
    for (const item of node) extractFromJsonNode(item, out);
    return out;
  }

  if (typeof node !== 'object') return out;

  if (Array.isArray(node.string_list_data)) {
    for (const item of node.string_list_data) {
      const fromHref = usernameFromInstagramUrl(item?.href);
      const fromValue = normalizeUsername(item?.value);
      if (fromHref) out.add(fromHref);
      else if (fromValue) out.add(fromValue);
    }
  }

  for (const value of Object.values(node)) extractFromJsonNode(value, out);
  return out;
}

export function extractFromHtml(html, out = new Set()) {
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html))) {
    const username = usernameFromInstagramUrl(match[1]);
    if (username) out.add(username);
  }
  return out;
}

export function readUsernames(inputPath) {
  const users = new Set();
  const files = listFilesRecursive(inputPath).filter(file => /\.(json|html?)$/i.test(file));

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    try {
      if (/\.json$/i.test(file)) extractFromJsonNode(JSON.parse(text), users);
      else extractFromHtml(text, users);
    } catch (error) {
      console.warn(`Ignored ${file}: ${error.message}`);
    }
  }

  return users;
}
