import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const bin = require("../bin/app-identity.js");
const { APP_NAME, NPM_LATEST_URL, PKG_NAME, REPO_URL } = await import("./app-identity.ts");

test("the app identity is the identity in package.json", () => {
  assert.equal(PKG_NAME, packageJson.name);
  assert.equal(APP_NAME, packageJson.name.split("/").pop());
  assert.equal(APP_NAME, Object.keys(packageJson.bin)[0]);
  assert.equal(NPM_LATEST_URL, `https://registry.npmjs.org/${packageJson.name.replace("/", "%2F")}/latest`);
  assert.equal(REPO_URL, packageJson.repository.url.replace(/^git\+/, "").replace(/\.git$/, ""));
  assert.equal(REPO_URL, packageJson.homepage.split("#")[0]);
});

test("the launcher and the app agree on that identity", () => {
  assert.deepEqual(bin, {
    BIN_NAME: APP_NAME,
    PKG_BASE: APP_NAME,
    PKG_NAME,
    PKG_SCOPE: PKG_NAME.slice(1, PKG_NAME.indexOf("/")),
  });
});
