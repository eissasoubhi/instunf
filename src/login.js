import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readJson, resolveFromRoot } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const config = readJson(path.join(rootDir, 'config.json'), {});
const profileDir = resolveFromRoot(rootDir, config.browserProfilePath ?? './browser-profile');

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
});

const page = context.pages()[0] ?? await context.newPage();
await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

console.log('\nLog in manually in the browser window.');
console.log('The credentials are entered directly into Instagram and are not stored by this project.');
console.log('When the Instagram home page is visible, return to this terminal.\n');

const rl = readline.createInterface({ input, output });
await rl.question('Press Enter to close the browser and keep the local session...');
rl.close();
await context.close();
