// The published identity of this package. `lib/app-identity.test.mjs` checks these
// against package.json, so a rename that forgets one of them fails a test instead
// of leaving the app named after whoever published the package it was forked from
// (or, worse, `update` installing that package over this one).
// bin/app-identity.js mirrors this for the launcher, which cannot import TypeScript.

/** The npm package name. */
export const PKG_NAME = "@hzrshz/pi-web-remote";

/** The package name without its npm scope: the name the installed app shows. */
export const APP_NAME = "pi-web-remote";

/** The GitHub repository holding this package's releases. */
export const REPO_URL = "https://github.com/bluesky4485/pi-web";

/** The npm `latest` metadata of this exact package. */
export const NPM_LATEST_URL = `https://registry.npmjs.org/${PKG_NAME.replace("/", "%2F")}/latest`;
