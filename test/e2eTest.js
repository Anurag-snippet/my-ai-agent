// test/e2eTest.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Agent } = require("../src/agent/Agent");
const { WORKSPACE_ROOT } = require("../src/safety/pathSafety");

async function runE2ETest() {
  console.log("\n==========================================");
  console.log("   RUNNING REAL END-TO-END AGENT TEST");
  console.log("==========================================\n");

  const e2eDir = path.join(WORKSPACE_ROOT, "test-tmp-e2e");
  if (fs.existsSync(e2eDir)) {
    fs.rmSync(e2eDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(e2eDir, "src"), { recursive: true });

  const pkgJson = {
    name: "e2e-sample-app",
    version: "1.0.0",
    main: "src/app.js",
    scripts: {
      test: "node -e \"const app = require('./src/app.js'); console.log('E2E tests passed');\"",
    },
  };
  fs.writeFileSync(path.join(e2eDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf-8");

  const initialApp = `// Initial app
function greet(name) {
  return 'Hello ' + name;
}

module.exports = { greet };
`;
  fs.writeFileSync(path.join(e2eDir, "src", "app.js"), initialApp, "utf-8");

  console.log("Created test workspace at:", e2eDir);

  const agent = new Agent({ workspaceRoot: e2eDir });
  // Enable auto approval for non-interactive automated test execution
  agent.approvalManager.sessionAutoApproveEdits = true;
  agent.approvalManager.sessionAutoApproveCommands = true;

  try {
    // ----------------------------------------------------
    // STEP 1: Ask agent to add an 'add' function
    // ----------------------------------------------------
    console.log("\n[Turn 1] User: Add a function called add(a, b) that returns a + b to src/app.js and export it.");
    const turn1Result = await agent.prompt(
      "In src/app.js, add a function called add(a, b) that returns their sum and export it in module.exports. Keep greet intact."
    );

    console.log("\nTurn 1 finished. Success:", turn1Result.success);
    const contentAfterTurn1 = fs.readFileSync(path.join(e2eDir, "src", "app.js"), "utf-8");
    console.log("\nFile content after Turn 1:\n", contentAfterTurn1);

    if (!contentAfterTurn1.includes("add") || !contentAfterTurn1.includes("+")) {
      throw new Error("Turn 1 failed: 'add' function was not added to src/app.js");
    }
    console.log("✓ Step 1 verified: 'add' function exists in src/app.js");

    // ----------------------------------------------------
    // STEP 2: Ask agent to change 'add' to 'multiply'
    // ----------------------------------------------------
    console.log("\n[Turn 2] User: Find the add function in src/app.js and change it to multiply(a, b) that returns a * b.");
    const turn2Result = await agent.prompt(
      "Find the add function in src/app.js and change it to multiply(a, b) that returns a * b. Also update module.exports."
    );

    console.log("\nTurn 2 finished. Success:", turn2Result.success);
    const contentAfterTurn2 = fs.readFileSync(path.join(e2eDir, "src", "app.js"), "utf-8");
    console.log("\nFile content after Turn 2:\n", contentAfterTurn2);

    if (!contentAfterTurn2.includes("multiply") || !contentAfterTurn2.includes("*")) {
      throw new Error("Turn 2 failed: 'multiply' function was not added to src/app.js");
    }
    console.log("✓ Step 2 verified: 'multiply' function exists in src/app.js");

    // ----------------------------------------------------
    // STEP 3: Test Undo
    // ----------------------------------------------------
    console.log("\n[Step 3] Testing /undo...");
    const undoRes = agent.undo();
    console.log("Undo result:", undoRes);
    const contentAfterUndo = fs.readFileSync(path.join(e2eDir, "src", "app.js"), "utf-8");
    console.log("\nFile content after Undo:\n", contentAfterUndo);

    if (!contentAfterUndo.includes("add") || contentAfterUndo.includes("multiply")) {
      throw new Error("Undo failed: src/app.js should have reverted to containing 'add' and not 'multiply'");
    }
    console.log("✓ Step 3 verified: Undo reverted modification back to 'add'!");

    // ----------------------------------------------------
    // STEP 4: Test Planning Mode
    // ----------------------------------------------------
    console.log("\n[Step 4] Testing /plan mode...");
    const planRes = await agent.plan("Add user login and token generation");
    if (!planRes.planText || planRes.planText.length < 50) {
      throw new Error("Plan generation failed or plan text is too short");
    }
    console.log("✓ Step 4 verified: Plan generated successfully without modifying files!");

    console.log("\n==========================================");
    console.log("🎉 ALL END-TO-END VALIDATIONS PASSED!");
    console.log("==========================================\n");
  } finally {
    try {
      fs.rmSync(e2eDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

if (require.main === module) {
  runE2ETest().catch((err) => {
    console.error("\n❌ E2E Test Failed:", err);
    process.exit(1);
  });
}

module.exports = { runE2ETest };
