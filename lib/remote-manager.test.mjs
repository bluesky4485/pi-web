import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { createRemoteManager, RemoteManagerError } = await jiti.import("./remote-manager.ts");

function fakeChild() {
  const emitter = new EventEmitter();
  emitter.kill = () => emitter.emit("killed");
  emitter.unref = () => {};
  return emitter;
}

function freshManager() {
  const key = `__test_${Math.random().toString(36).slice(2)}`;
  const manager = createRemoteManager(
    async () => ({ url: "https://abc.trycloudflare.com", child: fakeChild() }),
    key,
  );
  process.env.PI_WEB_PASSWORD = "secret";
  return manager;
}

test("start requires a password set at startup", async () => {
  const manager = freshManager();
  delete process.env.PI_WEB_PASSWORD;
  await assert.rejects(
    () => manager.start(),
    (err) => err instanceof RemoteManagerError && err.code === "PASSWORD_REQUIRED",
  );
});

test("start injects env and refuses a second concurrent start", async () => {
  const manager = freshManager();
  const result = await manager.start();
  assert.equal(result.url, "https://abc.trycloudflare.com");
  assert.equal(manager.isActive(), true);
  assert.deepEqual(JSON.parse(process.env.PI_WEB_REMOTE_URLS ?? "[]"), ["https://abc.trycloudflare.com"]);
  assert.ok((process.env.PI_WEB_ALLOWED_HOSTS ?? "").includes("abc.trycloudflare.com"));

  await assert.rejects(
    () => manager.start(),
    (err) => err instanceof RemoteManagerError && err.code === "ALREADY_ACTIVE",
  );
});

test("start refuses to stack a tunnel on top of a CLI-started one", async () => {
  const manager = freshManager();
  process.env.PI_WEB_REMOTE_URLS = '["https://cli.trycloudflare.com"]';
  await assert.rejects(
    () => manager.start(),
    (err) => err instanceof RemoteManagerError && err.code === "ALREADY_ACTIVE",
  );
  assert.equal(manager.isActive(), false, "manager should still be idle");
  delete process.env.PI_WEB_REMOTE_URLS;
  delete process.env.PI_WEB_PASSWORD;
});

test("stop clears the tunnel and unwinds the env", async () => {
  const manager = freshManager();
  process.env.PI_WEB_ALLOWED_HOSTS = "192.168.1.5,abc.trycloudflare.com";

  await manager.start();
  manager.stop();

  assert.equal(manager.isActive(), false);
  assert.equal(process.env.PI_WEB_REMOTE_URLS, "[]");
  assert.equal(process.env.PI_WEB_ALLOWED_HOSTS, "192.168.1.5", "keeps unrelated hosts, drops the tunnel host");

  delete process.env.PI_WEB_ALLOWED_HOSTS;
  delete process.env.PI_WEB_REMOTE_URLS;
  delete process.env.PI_WEB_PASSWORD;
});