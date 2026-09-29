// test/testHelper.js
const fs = require("fs");
const path = require("path");
const { WORKSPACE_ROOT } = require("../src/safety/pathSafety");

function createTempWorkspace() {
  const tmpDir = path.join(WORKSPACE_ROOT, "test-tmp-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6));
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function cleanupTempWorkspace(tmpDir) {
  try {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (_) {}
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    const fullMsg = `Assertion failed: ${message}`;
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(fullMsg);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    failed++;
    const msg = `${message} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`;
    console.error(`  ❌ FAILED: ${msg}`);
    throw new Error(msg);
  }
}

async function test(name, fn) {
  process.stdout.write(`• ${name}... `);
  try {
    await fn();
    passed++;
    console.log(`\x1b[32mPASS\x1b[0m`);
  } catch (err) {
    console.log(`\x1b[31mFAIL: ${err.message}\x1b[0m`);
  }
}

function getSummary() {
  return { passed, failed };
}

module.exports = {
  createTempWorkspace,
  cleanupTempWorkspace,
  assert,
  assertEqual,
  test,
  getSummary,
};
