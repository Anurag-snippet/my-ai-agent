// test/runTests.js
const path = require("path");
const fs = require("fs");
const {
  createTempWorkspace,
  cleanupTempWorkspace,
  assert,
  assertEqual,
  test,
  getSummary,
} = require("./testHelper");

// Modules to test
const { getSafePath, isSecretFile, isBinaryFile } = require("../src/safety/pathSafety");
const { classifyCommand, isDangerousCommand, CATEGORIES } = require("../src/safety/commandSafety");
const { createUnifiedDiff, colorizeDiff } = require("../src/utils/diff");
const { HistoryManager } = require("../src/utils/history");
const { ContextManager } = require("../src/agent/ContextManager");
const { ApprovalManager } = require("../src/agent/ApprovalManager");
const { listFiles, readFile, writeFile, editFile, deleteFile, moveFile, getFileInfo } = require("../src/tools/fileTools");
const { searchCode } = require("../src/tools/searchTools");
const { runCommand } = require("../src/tools/terminalTools");
const { gitStatus, gitDiff, gitLog, gitBranch } = require("../src/tools/gitTools");
const { analyzeProject, getProjectStructure } = require("../src/tools/projectTools");

async function runAllTests() {
  console.log("\n==========================================");
  console.log("   RUNNING AUTOMATED TEST SUITE");
  console.log("==========================================\n");

  const tempDir = createTempWorkspace();
  console.log(`Temp test workspace: ${tempDir}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Path Traversal Protection
    // ----------------------------------------------------
    await test("Path Safety - Traversal Protection", () => {
      let threw = false;
      try {
        getSafePath("../../outside.txt", tempDir);
      } catch (e) {
        threw = true;
        assert(e.code === "PATH_OUTSIDE_WORKSPACE", "Expected PATH_OUTSIDE_WORKSPACE code");
      }
      assert(threw, "getSafePath should throw on ../ traversal outside workspace");

      const validPath = getSafePath("src/app.js", tempDir);
      assert(validPath.startsWith(tempDir), "Valid path must resolve inside tempDir");
    });

    await test("Path Safety - Secret & Binary Detection", () => {
      assert(isSecretFile(".env"), ".env should be classified as secret");
      assert(isSecretFile(".env.local"), ".env.local should be classified as secret");
      assert(isSecretFile("id_rsa"), "id_rsa should be classified as secret");
      assert(!isSecretFile("app.js"), "app.js is not secret");

      assert(isBinaryFile("image.png"), "image.png is binary");
      assert(isBinaryFile("archive.zip"), "archive.zip is binary");
      assert(isBinaryFile("binary.exe"), "binary.exe is binary");
      assert(!isBinaryFile("code.js"), "code.js is not binary");
    });

    // ----------------------------------------------------
    // TEST 2: File Tools (Read, Write, Edit, Delete, Move, Info)
    // ----------------------------------------------------
    await test("File Tools - Write and Read with line range", () => {
      const filePath = "test-doc.txt";
      const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";
      const fullPath = path.join(tempDir, filePath);
      fs.writeFileSync(fullPath, content, "utf-8");

      // Read all lines
      const readAll = readFile({ filePath: fullPath });
      assert(readAll.success, "readFile should succeed");
      assertEqual(readAll.data.totalLines, 6, "Total lines should match");

      // Read range
      const readSlice = readFile({ filePath: fullPath, startLine: 2, endLine: 4 });
      assert(readSlice.success, "Reading slice should succeed");
      assertEqual(readSlice.data.linesReturned, 3, "Should return 3 lines");
      assert(readSlice.data.content.includes("Line 2"), "Should include Line 2");
      assert(!readSlice.data.content.includes("Line 1"), "Should not include Line 1");
    });

    await test("File Tools - Targeted File Editing", () => {
      const filePath = path.join(tempDir, "sample.js");
      fs.writeFileSync(filePath, "function hello() {\n  return 'world';\n}\n", "utf-8");

      const res = editFile({
        filePath,
        oldText: "return 'world';",
        newText: "return 'gemini';",
      });

      assert(res.success, "editFile should succeed");
      const updated = fs.readFileSync(filePath, "utf-8");
      assert(updated.includes("return 'gemini';"), "File content must reflect new text");

      // Verify ambiguous error
      fs.writeFileSync(filePath, "test test test", "utf-8");
      const ambig = editFile({ filePath, oldText: "test", newText: "pass" });
      assert(!ambig.success, "Ambiguous oldText must fail");
      assertEqual(ambig.error.code, "AMBIGUOUS_OLD_TEXT", "Error code should be AMBIGUOUS_OLD_TEXT");
    });

    await test("File Tools - Delete and Move", () => {
      const srcFile = path.join(tempDir, "to-move.txt");
      const dstFile = path.join(tempDir, "moved.txt");
      fs.writeFileSync(srcFile, "data to move", "utf-8");

      const moveRes = moveFile({ sourcePath: srcFile, destinationPath: dstFile });
      assert(moveRes.success, "moveFile should succeed");
      assert(!fs.existsSync(srcFile), "Original file should not exist after move");
      assert(fs.existsSync(dstFile), "Destination file should exist after move");

      const delRes = deleteFile({ filePath: dstFile });
      assert(delRes.success, "deleteFile should succeed");
      assert(!fs.existsSync(dstFile), "File should be deleted");
    });

    await test("File Tools - getFileInfo", () => {
      const sample = path.join(tempDir, "info-check.txt");
      fs.writeFileSync(sample, "hello\nworld\n", "utf-8");
      const info = getFileInfo({ filePath: sample });
      assert(info.success, "getFileInfo should succeed");
      assertEqual(info.data.isDirectory, false, "Should not be directory");
      assertEqual(info.data.lineCount, 3, "Line count should be 3");
    });

    // ----------------------------------------------------
    // TEST 3: Code Search Tool
    // ----------------------------------------------------
    await test("Search Tools - searchCode with context and regex", () => {
      // Create subfolder and search target
      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, "auth.js"),
        "// line 1\nfunction authenticateUser(user, pass) {\n  return true;\n}\n",
        "utf-8"
      );

      // We test searchCode with custom directory
      const searchRes = searchCode({
        query: "authenticateUser",
        searchDirectory: tempDir,
      });

      assert(searchRes.success, "searchCode should succeed");
      assert(searchRes.data.totalMatches >= 1, "Should find at least 1 match");
      const match = searchRes.data.results[0];
      assert(match.text.includes("authenticateUser"), "Match text should match query");
      assert(Array.isArray(match.context), "Match should contain context lines array");
    });

    // ----------------------------------------------------
    // TEST 4: Unified Diff Generation
    // ----------------------------------------------------
    await test("Diff Utility - Unified diff with hunks", () => {
      const oldText = "const a = 1;\nconst b = 2;\nconst c = 3;\n";
      const newText = "const a = 1;\nconst b = 200;\nconst c = 3;\n";

      const diff = createUnifiedDiff(oldText, newText, { filePath: "test.js" });
      assert(diff.includes("--- a/test.js"), "Diff should contain header");
      assert(diff.includes("@@"), "Diff should contain hunk header @@");
      assert(diff.includes("- const b = 2;"), "Diff should contain removed line");
      assert(diff.includes("+ const b = 200;"), "Diff should contain added line");

      const colored = colorizeDiff(diff);
      assert(colored.length > diff.length, "Colorized diff should contain ANSI codes");
    });

    // ----------------------------------------------------
    // TEST 5: Command Safety
    // ----------------------------------------------------
    await test("Command Safety - Categorization & Denylist", () => {
      // Destructive
      assert(classifyCommand("rm -rf /").category === CATEGORIES.DESTRUCTIVE, "rm -rf is DESTRUCTIVE");
      assert(classifyCommand("rmdir /s /q test").category === CATEGORIES.DESTRUCTIVE, "rmdir /s is DESTRUCTIVE");
      assert(classifyCommand("git reset --hard HEAD~1").category === CATEGORIES.DESTRUCTIVE, "git reset --hard is DESTRUCTIVE");
      assert(classifyCommand("git clean -fd").category === CATEGORIES.DESTRUCTIVE, "git clean -fd is DESTRUCTIVE");
      assert(classifyCommand("format C:").category === CATEGORIES.DESTRUCTIVE, "format is DESTRUCTIVE");

      // High Risk
      assert(classifyCommand("git push origin main --force").category === CATEGORIES.HIGH_RISK, "force push is HIGH_RISK");
      assert(classifyCommand("git branch -D feat").category === CATEGORIES.HIGH_RISK, "git branch -D is HIGH_RISK");

      // Safe
      assert(classifyCommand("npm test").category === CATEGORIES.SAFE, "npm test is SAFE");
      assert(classifyCommand("git status").category === CATEGORIES.SAFE, "git status is SAFE");
      assert(classifyCommand("node --version").category === CATEGORIES.SAFE, "node --version is SAFE");

      // Denylist block
      const blocked = classifyCommand("format", { denyCommands: ["format"] });
      assert(!blocked.isAllowed, "Denied command must have isAllowed = false");
    });

    // ----------------------------------------------------
    // TEST 6: Terminal Execution
    // ----------------------------------------------------
    await test("Terminal Tools - Execution and exit codes", () => {
      const res = runCommand({ command: "node -e \"console.log('ANTIGRAVITY_TEST_OK')\"" });
      assert(res.success, "Node command should execute successfully");
      assertEqual(res.data.exitCode, 0, "Exit code should be 0");
      assert(res.data.stdout.includes("ANTIGRAVITY_TEST_OK"), "stdout should contain expected output");

      // Error exit code
      const failRes = runCommand({ command: "node -e \"process.exit(42)\"" });
      assertEqual(failRes.data.exitCode, 42, "Failed command should capture exitCode 42");
    });

    // ----------------------------------------------------
    // TEST 7: Git Tools
    // ----------------------------------------------------
    await test("Git Tools - Status and Diff in current workspace", () => {
      const statusRes = gitStatus();
      assert(statusRes.success, "gitStatus should succeed");
      assert(typeof statusRes.data.branch === "string", "Branch must be a string");

      const branchRes = gitBranch();
      assert(branchRes.success, "gitBranch should succeed");
    });

    // ----------------------------------------------------
    // TEST 8: History Manager (Undo / Redo)
    // ----------------------------------------------------
    await test("History Manager - Undo and Redo", () => {
      const hist = new HistoryManager(tempDir);
      const testFile = path.join(tempDir, "history-test.txt");

      // 1. Initial write
      fs.writeFileSync(testFile, "version 1", "utf-8");
      hist.recordChange({
        type: "write",
        filePath: "history-test.txt",
        oldContent: null,
        newContent: "version 1",
      });

      // 2. Edit
      fs.writeFileSync(testFile, "version 2", "utf-8");
      hist.recordChange({
        type: "edit",
        filePath: "history-test.txt",
        oldContent: "version 1",
        newContent: "version 2",
      });

      // 3. Undo
      const undoRes = hist.undo();
      assert(undoRes.success, "Undo should succeed");
      const current = fs.readFileSync(testFile, "utf-8");
      assertEqual(current, "version 1", "File should be restored to version 1");

      // 4. Redo
      const redoRes = hist.redo();
      assert(redoRes.success, "Redo should succeed");
      const redone = fs.readFileSync(testFile, "utf-8");
      assertEqual(redone, "version 2", "File should be restored to version 2");
    });

    // ----------------------------------------------------
    // TEST 9: Approval Manager
    // ----------------------------------------------------
    await test("Approval Manager - Session Auto-approval", async () => {
      const approval = new ApprovalManager();
      // Test session auto approve flag
      approval.sessionAutoApproveEdits = true;
      const res = await approval.requestFileApproval("test.js", "+ line", "EDIT");
      assert(res.approved, "Should auto-approve when session flag is enabled");

      approval.resetSession();
      assert(!approval.sessionAutoApproveEdits, "Session reset must clear auto-approval flag");
    });

    // ----------------------------------------------------
    // TEST 10: Context Manager & Compaction
    // ----------------------------------------------------
    await test("Context Manager - Working memory & compaction", () => {
      const ctx = new ContextManager(1000);
      ctx.setCurrentTask("Refactor authentication");
      ctx.recordModifiedFile("src/auth.js");
      ctx.recordTestRun("npm test", true, "All 5 tests passed");

      assertEqual(ctx.memory.currentTask, "Refactor authentication", "Task should match");
      assert(ctx.memory.modifiedFiles.has("src/auth.js"), "Modified files should include src/auth.js");

      // Add messages
      ctx.addUserMessage("Initial message");
      assertEqual(ctx.getContents().length, 1, "Should have 1 message");
    });

    // ----------------------------------------------------
    // TEST 11: Project Tools (Analyze and Structure)
    // ----------------------------------------------------
    await test("Project Tools - analyzeProject and getProjectStructure", () => {
      const analysis = analyzeProject();
      assert(analysis.success, "analyzeProject should succeed");
      assertEqual(analysis.data.projectType, "Node.js", "Should detect Node.js");
      assertEqual(analysis.data.language, "JavaScript", "Should detect JavaScript");
      assert(analysis.data.testCommands.length > 0, "Should detect test command");

      const structure = getProjectStructure({ maxDepth: 2 });
      assert(structure.success, "getProjectStructure should succeed");
      assert(structure.data.structure.length > 0, "Should list files");
    });

  } finally {
    cleanupTempWorkspace(tempDir);
  }

  const { passed, failed } = getSummary();
  console.log("\n==========================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
  });
}

module.exports = { runAllTests };
