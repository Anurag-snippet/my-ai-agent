// src/ui/cli.js
const readline = require("readline");
const { Agent } = require("../agent/Agent");
const { banner, divider, COLORS } = require("./renderer");
const { getProjectStructure, analyzeProject } = require("../tools/projectTools");
const { gitStatus, gitDiff, gitLog } = require("../tools/gitTools");
const { runCommand } = require("../tools/terminalTools");

async function startCli() {
  const agent = new Agent();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n${COLORS.bold}${COLORS.magenta}You:${COLORS.reset} `,
  });

  // Attach shared readline to approval manager so stdin is never locked or duplicated
  agent.approvalManager.setSharedReadline(rl);

  banner({
    model: agent.config.model,
    workspace: agent.workspaceRoot,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "exit" || input === "/exit") {
      console.log(`\n${COLORS.cyan}Goodbye! Happy coding.${COLORS.reset}\n`);
      rl.close();
      process.exit(0);
    }

    // ==========================================
    // SLASH COMMANDS
    // ==========================================
    if (input.startsWith("/")) {
      const parts = input.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = input.substring(cmd.length).trim();

      switch (cmd) {
        case "/help":
          printHelp();
          break;

        case "/clear":
          console.clear();
          banner({ model: agent.config.model, workspace: agent.workspaceRoot });
          break;

        case "/reset":
          agent.reset();
          console.log(`\n${COLORS.green}✓ Session reset. Context and approvals cleared.${COLORS.reset}`);
          break;

        case "/status":
          printStatus(agent);
          break;

        case "/plan":
          if (!arg) {
            console.log(`\n${COLORS.yellow}Usage: /plan <task description>${COLORS.reset}`);
          } else {
            await agent.plan(arg);
          }
          break;

        case "/undo": {
          const res = agent.undo();
          if (res.success) {
            console.log(`\n${COLORS.green}✓ ${res.message}${COLORS.reset}`);
          } else {
            console.log(`\n${COLORS.yellow}ℹ ${res.message}${COLORS.reset}`);
          }
          break;
        }

        case "/redo": {
          const res = agent.redo();
          if (res.success) {
            console.log(`\n${COLORS.green}✓ ${res.message}${COLORS.reset}`);
          } else {
            console.log(`\n${COLORS.yellow}ℹ ${res.message}${COLORS.reset}`);
          }
          break;
        }

        case "/history": {
          const hist = agent.getHistory();
          if (hist.length === 0) {
            console.log(`\n${COLORS.gray}No file modifications recorded in this session.${COLORS.reset}`);
          } else {
            divider("MODIFICATION HISTORY");
            hist.forEach((h, i) => {
              console.log(`${i + 1}. [${h.type.toUpperCase()}] ${h.filePath || h.oldPath || h.newPath} (${h.timestamp})`);
            });
            divider();
          }
          break;
        }

        case "/diff": {
          const diffRes = gitDiff();
          divider("GIT UNCOMMITTED CHANGES");
          console.log(diffRes.data?.diff || "No uncommitted changes.");
          divider();
          break;
        }

        case "/tree": {
          const treeRes = getProjectStructure({ maxDepth: 3 });
          divider("PROJECT FILE STRUCTURE");
          (treeRes.data?.structure || []).forEach((f) => console.log(`  ${f}`));
          divider();
          break;
        }

        case "/model": {
          if (!arg) {
            console.log(`\n${COLORS.cyan}Current model: ${agent.config.model}${COLORS.reset}`);
          } else {
            agent.setModel(arg);
            console.log(`\n${COLORS.green}✓ Switched model to: ${arg}${COLORS.reset}`);
          }
          break;
        }

        case "/context": {
          const size = agent.contextManager.estimateSize();
          const memory = agent.contextManager.getMemorySummary();
          divider("CONTEXT & WORKING MEMORY");
          console.log(`Estimated Context Size: ~${size} characters`);
          console.log(`Project Stack: ${memory.projectType} (${memory.framework || "none"})`);
          console.log(`Files Inspected: ${memory.relevantFiles.join(", ") || "none"}`);
          console.log(`Files Modified:  ${memory.modifiedFiles.join(", ") || "none"}`);
          divider();
          break;
        }

        case "/compact":
          agent.contextManager.compactIfNeeded();
          console.log(`\n${COLORS.green}✓ Context compacted.${COLORS.reset}`);
          break;

        case "/test": {
          const analysis = analyzeProject().data;
          const cmdToRun = analysis.testCommands[0] || "npm test";
          console.log(`\n⚙ Running test suite: ${cmdToRun}...`);
          const testRes = runCommand({ command: cmdToRun });
          if (testRes.success && testRes.data?.success) {
            console.log(`\n${COLORS.green}✓ Tests Passed:\n${testRes.data.stdout}${COLORS.reset}`);
          } else {
            console.log(`\n${COLORS.red}✗ Tests Failed:\n${testRes.data?.stderr || testRes.data?.stdout || testRes.error?.message}${COLORS.reset}`);
          }
          break;
        }

        case "/lint": {
          const analysis = analyzeProject().data;
          const cmdToRun = analysis.lintCommands[0] || "npm run lint";
          console.log(`\n⚙ Running linter: ${cmdToRun}...`);
          const lintRes = runCommand({ command: cmdToRun });
          console.log(lintRes.data?.stdout || lintRes.data?.stderr || "No lint output.");
          break;
        }

        case "/build": {
          const analysis = analyzeProject().data;
          const cmdToRun = analysis.buildCommands[0] || "npm run build";
          console.log(`\n⚙ Running build: ${cmdToRun}...`);
          const buildRes = runCommand({ command: cmdToRun });
          console.log(buildRes.data?.stdout || buildRes.data?.stderr || "No build output.");
          break;
        }

        case "/git": {
          if (arg === "status" || !arg) {
            const res = gitStatus();
            console.log("\n" + (res.data?.raw || "Git status unavailable."));
          } else if (arg === "diff") {
            const res = gitDiff();
            console.log("\n" + (res.data?.diff || "No changes."));
          } else if (arg.startsWith("log")) {
            const res = gitLog({ count: 5 });
            console.log("\n" + (res.data?.raw || "No commits."));
          } else {
            console.log(`\n${COLORS.yellow}Supported: /git status, /git diff, /git log${COLORS.reset}`);
          }
          break;
        }

        default:
          console.log(`\n${COLORS.yellow}Unknown command: ${cmd}. Type /help for available commands.${COLORS.reset}`);
      }

      rl.prompt();
      return;
    }

    // ==========================================
    // AGENT PROMPT EXECUTION
    // ==========================================
    try {
      console.log(`\n${COLORS.dim}🤔 Analyzing and reasoning...${COLORS.reset}`);
      await agent.prompt(input);
    } catch (err) {
      console.error(`\n${COLORS.red}Error: ${err.message}${COLORS.reset}`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

function printHelp() {
  divider("AVAILABLE COMMANDS");
  const cmds = [
    ["/help", "Show this help menu"],
    ["/plan <task>", "Create a step-by-step implementation plan without modifying files"],
    ["/undo", "Revert the last approved file modification"],
    ["/redo", "Re-apply the last undone file modification"],
    ["/history", "Show file modification audit history for this session"],
    ["/diff", "Show uncommitted git changes"],
    ["/status", "Display agent session status and working memory"],
    ["/tree", "Display project file structure tree"],
    ["/model [name]", "Show or change active Gemini model"],
    ["/context", "Show context size and relevant files"],
    ["/compact", "Manually compact conversation context"],
    ["/test", "Run project test suite"],
    ["/lint", "Run project linter"],
    ["/build", "Run project build script"],
    ["/git <cmd>", "Run git status, diff, or log"],
    ["/reset", "Clear conversation history and reset approvals"],
    ["/clear", "Clear terminal screen"],
    ["/exit", "Exit the agent"],
  ];

  cmds.forEach(([c, d]) => {
    console.log(`  ${COLORS.cyan}${c.padEnd(16)}${COLORS.reset} ${d}`);
  });
  divider();
}

function printStatus(agent) {
  const status = agent.getStatus();
  divider("AGENT STATUS");
  console.log(`Model:           ${status.model}`);
  console.log(`Workspace:       ${status.workspace}`);
  console.log(`Project Stack:   ${status.memory.projectType} (${status.memory.framework || "no framework"})`);
  console.log(`Relevant Files:  ${status.memory.relevantFiles.join(", ") || "none"}`);
  console.log(`Modified Files:  ${status.memory.modifiedFiles.join(", ") || "none"}`);
  console.log(`Undo Available:  ${status.undoAvailable ? "Yes" : "No"}`);
  console.log(`Redo Available:  ${status.redoAvailable ? "Yes" : "No"}`);
  console.log(`Edits In Session:${status.historyCount}`);
  divider();
}

module.exports = {
  startCli,
};
