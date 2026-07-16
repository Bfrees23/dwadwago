import { allowedAdminLogins, loginWithGitHubToken } from "./admin.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testAllowlist() {
  const set = allowedAdminLogins();
  assert(set.has("bfrees23"), "owner allowlisted");
  assert(!set.has("hacker"), "strangers blocked");
}

async function testRejectEmpty() {
  const r = await loginWithGitHubToken("");
  assert(!r.ok, "empty rejected");
}

async function testRejectShort() {
  const r = await loginWithGitHubToken("short");
  assert(!r.ok, "short rejected");
}

testAllowlist();
await testRejectEmpty();
await testRejectShort();
console.log("Admin tests passed");
