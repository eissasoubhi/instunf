import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  normalizeUsername,
  randomInt,
  readJson,
  resolveFromRoot,
  sleep,
  writeJson,
} from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const config = readJson(path.join(rootDir, 'config.json'), {});

const live = process.argv.includes('--live');
const candidatesPath = resolveFromRoot(rootDir, config.candidatesPath ?? './data/to-unfollow.json');
const processedPath = resolveFromRoot(rootDir, config.processedPath ?? './data/processed.json');
const profileDir = resolveFromRoot(rootDir, config.browserProfilePath ?? './browser-profile');

const maxPerRun = Number(config.maxPerRun ?? 20);
const minDelaySeconds = Number(config.minDelaySeconds ?? 10);
const maxDelaySeconds = Number(config.maxDelaySeconds ?? 40);
const navigationTimeoutMs = Number(config.navigationTimeoutMs ?? 30000);
const actionTimeoutMs = Number(config.actionTimeoutMs ?? 10000);
const postActionVerificationMs = Number(config.postActionVerificationMs ?? 8000);

if (!Number.isInteger(maxPerRun) || maxPerRun < 1) throw new Error('maxPerRun must be an integer >= 1');
if (!Number.isFinite(minDelaySeconds) || !Number.isFinite(maxDelaySeconds) || minDelaySeconds < 0 || maxDelaySeconds < minDelaySeconds) {
  throw new Error('Invalid minDelaySeconds/maxDelaySeconds');
}
if (!fs.existsSync(candidatesPath)) {
  console.error('Candidate list not found. Run `npm run compare` first.');
  process.exit(1);
}

const candidates = [...new Set(readJson(candidatesPath, []).map(normalizeUsername).filter(Boolean))];
const processed = readJson(processedPath, []);
const processedUsers = new Set(
  processed.map(entry => normalizeUsername(typeof entry === 'string' ? entry : entry?.username)).filter(Boolean),
);
const queue = candidates.filter(user => !processedUsers.has(user)).slice(0, maxPerRun);

if (!queue.length) {
  console.log('Nothing to process.');
  process.exit(0);
}

console.log(live
  ? 'LIVE MODE: unfollow actions are enabled.'
  : 'DRY RUN: profiles are inspected but no unfollow action is performed.');
console.log(`Queue this run: ${queue.length}`);
console.log(`Remaining before this run: ${candidates.length - processedUsers.size}`);
console.log(`Traffic pacing: ${minDelaySeconds}-${maxDelaySeconds}s between accounts\n`);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: Boolean(config.headless),
  viewport: null,
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(actionTimeoutMs);

function profileScope() {
  return page.locator('header').first();
}

async function pageTextLowercase() {
  return (await page.locator('body').innerText().catch(() => '')).toLowerCase();
}

async function detectStopCondition() {
  const url = page.url().toLowerCase();
  if (url.includes('/challenge/') || url.includes('/checkpoint/')) return `challenge URL: ${url}`;
  if (url.includes('/accounts/login')) return 'login required';

  const body = await pageTextLowercase();
  const signals = [
    'try again later',
    'please wait a few minutes',
    'we restrict certain activity',
    'challenge required',
    'suspicious activity',
    'confirm your identity',
    'confirmez votre identité',
    'réessayez plus tard',
    'veuillez patienter quelques minutes',
    'nous limitons la fréquence',
    'activité suspecte',
  ];
  return signals.find(signal => body.includes(signal)) ?? null;
}

async function findProfileButton(patterns) {
  for (const pattern of patterns) {
    const inHeader = profileScope().getByRole('button', { name: pattern }).first();
    if (await inHeader.count()) return inHeader;
  }
  return null;
}

async function findFollowingButton() {
  return findProfileButton([
    /^following$/i,
    /^suivi\(e\)$/i,
    /^suivi$/i,
    /^abonné\(e\)$/i,
    /^abonné$/i,
  ]);
}

async function findFollowButton() {
  return findProfileButton([/^follow$/i, /^suivre$/i]);
}

async function clickUnfollowConfirmation() {
  const dialog = page.getByRole('dialog').last();
  const patterns = [/^unfollow$/i, /^se désabonner$/i];
  for (const pattern of patterns) {
    const button = dialog.getByRole('button', { name: pattern }).first();
    if (await button.count()) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function waitUntilNotFollowing() {
  try {
    await page.waitForFunction(() => {
      const header = document.querySelector('header');
      if (!header) return false;
      const texts = [...header.querySelectorAll('button')].map(button => (button.textContent || '').trim().toLowerCase());
      return texts.some(text => text === 'follow' || text === 'suivre');
    }, null, { timeout: postActionVerificationMs });
    return true;
  } catch {
    return false;
  }
}

function record(username, status) {
  processed.push({ username, status, at: new Date().toISOString() });
  processedUsers.add(username);
  writeJson(processedPath, processed);
}

let actions = 0;
let inspected = 0;
let stoppedReason = null;

try {
  for (let index = 0; index < queue.length; index++) {
    const username = queue[index];
    console.log(`[${index + 1}/${queue.length}] @${username}`);

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });
    inspected++;

    const stopSignal = await detectStopCondition();
    if (stopSignal) {
      stoppedReason = `Instagram displayed a stop condition (${stopSignal})`;
      console.error(`  Stopped: ${stoppedReason}.`);
      break;
    }

    const followButton = await findFollowButton();
    if (followButton) {
      if (live) record(username, 'already-not-following');
      console.log(live ? '  Already not following; recorded.' : '  Dry run: already not following.');
    } else if (!live) {
      const followingButton = await findFollowingButton();
      if (!followingButton) {
        stoppedReason = 'expected profile follow state was not found';
        console.warn('  Could not identify the profile follow state. Stopping.');
        break;
      }
      console.log('  Dry run: would unfollow.');
    } else {
      const followingButton = await findFollowingButton();
      if (!followingButton) {
        stoppedReason = 'Following button not found';
        console.warn('  Could not find the Following button. Stopping to avoid acting on an unexpected UI.');
        break;
      }

      await followingButton.click();
      const confirmed = await clickUnfollowConfirmation();
      if (!confirmed) {
        stoppedReason = 'Unfollow confirmation not found';
        console.warn('  Could not find the Unfollow confirmation. Stopping.');
        break;
      }

      const afterSignal = await detectStopCondition();
      if (afterSignal) {
        stoppedReason = `Instagram displayed a stop condition (${afterSignal})`;
        console.error(`  Stopped: ${stoppedReason}.`);
        break;
      }

      const verified = await waitUntilNotFollowing();
      if (!verified) {
        stoppedReason = 'unfollow action could not be verified';
        console.warn('  The UI did not confirm the unfollow. Stopping without recording this account.');
        break;
      }

      record(username, 'unfollowed');
      actions++;
      console.log('  Unfollowed and verified.');
    }

    if (index < queue.length - 1) {
      const delay = randomInt(minDelaySeconds, maxDelaySeconds);
      console.log(`  Waiting ${delay}s before the next account...`);
      await sleep(delay * 1000);
    }
  }
} finally {
  await context.close();
}

console.log(`\nInspected this run: ${inspected}`);
console.log(`Completed unfollows this run: ${actions}`);
if (live) console.log(`Processed log: ${processedPath}`);
if (stoppedReason) console.log(`Stopped reason: ${stoppedReason}`);
