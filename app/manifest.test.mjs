import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createJiti } from "jiti";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { default: manifest, dynamic } = await jiti.import("./manifest.ts");
const { APP_NAME } = await jiti.import("@/lib/app-identity");

test("manifest reads the app name at runtime without changing other metadata", () => {
  const original = process.env.PI_WEB_APP_NAME;
  try {
    assert.equal(dynamic, "force-dynamic");
    delete process.env.PI_WEB_APP_NAME;
    const defaults = manifest();
    assert.equal(defaults.name, APP_NAME);
    assert.equal(defaults.short_name, APP_NAME);
    assert.equal(APP_NAME, require("../package.json").name.split("/").pop());

    // Reuse the same imported function: the environment must not be captured
    // at module load time (or baked into a statically generated manifest).
    for (const [value, expected] of [
      ["", APP_NAME],
      [" \t\n ", APP_NAME],
      ["Work Pi", "Work Pi"],
      ["  工作 Pi 🚀 \n", "工作 Pi 🚀"],
      ["Another Pi", "Another Pi"],
    ]) {
      process.env.PI_WEB_APP_NAME = value;
      assert.deepEqual(manifest(), {
        ...defaults,
        name: expected,
        short_name: expected,
      });
    }
  } finally {
    if (original === undefined) delete process.env.PI_WEB_APP_NAME;
    else process.env.PI_WEB_APP_NAME = original;
  }
});
