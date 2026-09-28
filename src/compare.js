import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readUsernames } from './export-parser.js';
import { normalizeUsername, readJson, resolveFromRoot, writeJson } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const config = readJson(path.join(rootDir, 'config.json'), {});

const followersPath = resolveFromRoot(rootDir, config.followersPath ?? './data/followers');
const followingPath = resolveFromRoot(rootDir, config.followingPath ?? './data/following');
const whitelistPath = resolveFromRoot(rootDir, config.whitelistPath ?? './data/whitelist.json');
const candidatesPath = resolveFromRoot(rootDir, config.candidatesPath ?? './data/to-unfollow.json');

if (!fs.existsSync(followersPath) || !fs.existsSync(followingPath)) {
  console.error('Missing Instagram export folders.');
  console.error(`Expected followers under: ${followersPath}`);
  console.error(`Expected following under: ${followingPath}`);
  process.exit(1);
}

const followers = readUsernames(followersPath);
const following = readUsernames(followingPath);
const whitelistRaw = readJson(whitelistPath, []);
const whitelist = new Set(whitelistRaw.map(normalizeUsername).filter(Boolean));

if (!followers.size || !following.size) {
  console.warn('Warning: one of the parsed lists is empty. Check the export folders before running live mode.');
}

const candidates = [...following]
  .filter(user => !followers.has(user))
  .filter(user => !whitelist.has(user))
  .sort((a, b) => a.localeCompare(b));

writeJson(candidatesPath, candidates);

console.log(`Followers:        ${followers.size}`);
console.log(`Following:        ${following.size}`);
console.log(`Whitelisted:      ${whitelist.size}`);
console.log(`To unfollow:      ${candidates.length}`);
console.log(`Saved to:         ${candidatesPath}`);
