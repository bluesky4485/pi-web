import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  extractTunnelUrl,
  TAILNET_IP_RE,
  generatePassword,
} = require("./remote.js");

test("extractTunnelUrl finds the URL across split output chunks", () => {
  const firstChunk = "Your quick tunnel has been created! Visit it at (it may take some time to be reachable):\nhttps://ab";
  assert.equal(extractTunnelUrl(firstChunk), null, "partial URL must not match yet");
  const secondChunk = "cd-1234.trycloudflare.com\nINF Registered tunnel connection";
  assert.equal(
    extractTunnelUrl(firstChunk + secondChunk),
    "https://abcd-1234.trycloudflare.com",
  );
});

test("extractTunnelUrl rejects non-tunnel output", () => {
  assert.equal(extractTunnelUrl("INF Starting tunnel\nno url here https://example.com"), null);
  assert.equal(extractTunnelUrl(""), null);
});

test("TAILNET_IP_RE accepts tailnet addresses only", () => {
  assert.ok(TAILNET_IP_RE.test("100.64.0.3"));
  assert.ok(TAILNET_IP_RE.test("100.101.102.103"));
  assert.ok(!TAILNET_IP_RE.test("192.168.1.1"));
  assert.ok(!TAILNET_IP_RE.test("100.64.0.999"));
  assert.ok(!TAILNET_IP_RE.test("100.64.0.3 "));
});

test("generatePassword is the requested length and hex", () => {
  for (const length of [8, 16, 32]) {
    const password = generatePassword(length);
    assert.equal(password.length, length);
    assert.match(password, /^[0-9a-f]+$/);
  }
  assert.notEqual(generatePassword(16), generatePassword(16), "must be random");
});
