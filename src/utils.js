import fs from 'node:fs';
import path from 'node:path';

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

export function normalizeUsername(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function usernameFromInstagramUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})(?:\/|\?|#|$)/i);
  if (!match) return null;

  const reserved = new Set([
    'accounts', 'about', 'api', 'developer', 'direct', 'explore', 'p',
    'privacy', 'reel', 'reels', 'stories', 'terms', 'web',
  ]);
  const username = normalizeUsername(match[1]);
  return username && !reserved.has(username) ? username : null;
}

export function resolveFromRoot(rootDir, p) {
  return path.isAbsolute(p) ? p : path.resolve(rootDir, p);
}

export function listFilesRecursive(inputPath) {
  if (!fs.existsSync(inputPath)) return [];
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return [inputPath];

  const result = [];
  for (const entry of fs.readdirSync(inputPath, { withFileTypes: true })) {
    const full = path.join(inputPath, entry.name);
    if (entry.isDirectory()) result.push(...listFilesRecursive(full));
    else result.push(full);
  }
  return result;
}
