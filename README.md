# instunf

A small local helper for cleaning up your own Instagram following list.

It:

1. reads Instagram's exported followers/following files;
2. computes `following - followers`;
3. excludes an optional local whitelist;
4. opens Instagram in a visible Playwright browser session;
5. unfollows a limited number of candidates through the normal web UI;
6. spaces actions out to avoid hammering the interface;
7. stops instead of retrying around challenges, login checks, rate limits, or unexpected UI;
8. verifies the profile shows `Follow` / `Suivre` before recording an unfollow as successful.

It intentionally does **not** include stealth plugins, fingerprint spoofing, CAPTCHA bypasses, proxy rotation, challenge bypasses, or other anti-detection mechanisms.

> Instagram can still limit automated activity. Conservative pacing reduces request bursts but cannot guarantee that an account will never be limited. If Instagram asks you to stop, verify your identity, or try again later, this tool stops too.

## Requirements

- Node.js 20+
- npm

## Install

```bash
npm install
npm run install-browser
```

## 1. Export followers/following from Instagram

Request an Instagram data export from Meta Accounts Center. Put the extracted follower files under:

```text
data/followers/
```

and the following files under:

```text
data/following/
```

JSON and HTML exports are supported and subdirectories are scanned recursively.

These folders are ignored by Git because they can contain personal data.

## 2. Optional whitelist

Create `data/whitelist.json` from the example:

```bash
cp data/whitelist.example.json data/whitelist.json
```

Then keep any accounts you never want added to the candidate list:

```json
[
  "friend_one",
  "friend_two"
]
```

`data/whitelist.json` is local-only and ignored by Git.

## 3. Build the candidate list

```bash
npm run compare
```

This writes `data/to-unfollow.json`, which is also ignored by Git.

Review that file before the first live run.

## 4. Login once

```bash
npm run login
```

A Chromium window opens. Log in directly on Instagram, return to the terminal, and press Enter once the home page is visible.

The browser session is stored only in `browser-profile/`, which is ignored by Git.

## 5. Dry run

```bash
npm run unfollow
```

Dry run opens candidate profiles and checks the expected follow state. It does not click Unfollow or write processed history.

## 6. Live run

```bash
npm run unfollow:live
```

or:

```bash
npm run unfollow -- --live
```

By default a live run:

- handles at most 20 candidates;
- waits 10 to 40 seconds between accounts for traffic pacing;
- stops on a challenge/checkpoint/login page;
- stops on known rate-limit/activity-restriction messages;
- stops if the expected Instagram UI is missing;
- records an account only after the resulting `Follow` / `Suivre` state is visible;
- resumes next time using `data/processed.json`.

## Configuration

Edit `config.json`:

```json
{
  "maxPerRun": 20,
  "minDelaySeconds": 10,
  "maxDelaySeconds": 40,
  "headless": false
}
```

Keep `headless` set to `false` so you can see exactly what the script is doing and close the browser if Instagram changes its interface.

The 10-40 second interval is traffic pacing, not a guarantee against account limits.

## Local data safety

The following are never meant to be committed:

```text
browser-profile/
data/followers/
data/following/
data/to-unfollow.json
data/processed.json
data/whitelist.json
```

Do not commit Instagram cookies, exported account data, credentials, or personal account lists.

## Tests

```bash
npm run check
npm test
```
