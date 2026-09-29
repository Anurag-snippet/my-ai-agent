# My AI Agent

A production-quality, autonomous AI coding agent running directly in your workspace, powered by **Google Gemini** with structured function calling, real-time streaming, and robust safety controls.

---

## Overview

**My AI Agent** acts as an autonomous pair programmer. It does not blindly guess file paths or make assumptions—it inspects your codebase, analyzes dependencies and frameworks, plans minimal surgical edits, generates unified diffs for interactive user approval, and executes tests or linters to empirically verify its work.

---

## Architecture & System Design

The agent is organized into clean, single-responsibility modules:

```
my-ai-agent/
├── src/
│   ├── agent/
│   │   ├── Agent.js             # High-level orchestrator & session lifecycle
│   │   ├── AgentLoop.js         # Iterative reasoning, multi-tool execution & verification
│   │   ├── ApprovalManager.js   # Centralized approval system ([y/n/a]) with session memory
│   │   ├── ContextManager.js    # Compaction, token budgeting & working memory
│   │   ├── Planner.js           # Read-only planning mode (/plan)
│   │   ├── ToolExecutor.js      # Tool dispatch, safety gating, diff calculation & history
│   │   └── prompts.js           # Senior engineer system prompts
│   ├── safety/
│   │   ├── commandSafety.js     # SAFE / LOW_RISK / HIGH_RISK / DESTRUCTIVE categorization & policies
│   │   └── pathSafety.js        # Workspace traversal defense, symlinks, binary & secret guards
│   ├── tools/
│   │   ├── index.js             # Unified tool registry & Gemini function declarations
│   │   ├── fileTools.js         # listFiles, readFile, writeFile, editFile, deleteFile, moveFile, getFileInfo
│   │   ├── searchTools.js       # Real code search (regex, exact, context lines, filters)
│   │   ├── terminalTools.js     # Safe terminal execution with exit code, stdout, stderr, timeout
│   │   ├── gitTools.js          # gitStatus, gitDiff, gitLog, gitBranch, gitShow, gitBlame
│   │   └── projectTools.js      # Stack analysis & structure tree
│   ├── ui/
│   │   ├── cli.js               # Interactive REPL & slash command processor
│   │   ├── renderer.js          # Unified diff cards, boxes, status indicators & banners
│   │   └── spinner.js           # Terminal activity indicator
│   └── utils/
│       ├── config.js            # Configuration (.agent/config.json + env vars)
│       ├── diff.js              # LCS-based unified diff with hunk generation & colorization
│       ├── errors.js            # Standardized tool results and AgentError hierarchy
│       ├── history.js           # Audit trail with full /undo & /redo support
│       └── logger.js            # Structured logger with automatic secret redaction
├── test/
│   ├── runTests.js              # Automated test suite (15 unit & integration tests)
│   ├── e2eTest.js               # Live end-to-end coding agent validation
│   └── testHelper.js            # Isolated test workspace fixtures
├── index.js                     # CLI entry point
├── package.json
└── README.md
```

---

## How It Works

```
USER REQUEST
     ↓
[1. UNDERSTAND]  Extract intent, context, and requirements
     ↓
[2. INSPECT]     Analyze project type, search codebase, read relevant files
     ↓
[3. PLAN]        Formulate the minimal surgical change required
     ↓
[4. DIFF & APPROVE] Generate unified diff; prompt user ([y]es, [n]o, [a]pprove all)
     ↓
[5. APPLY & SNAPSHOT] Write changes and record in history for instant /undo
     ↓
[6. VERIFY]      Automatically run project tests, linter, or syntax checks
     ↓
[7. REPAIR LOOP] If verification fails, inspect errors and iterate (up to 3 times)
     ↓
[8. FINAL REPORT] Summarize what changed, files modified, and verification evidence
```

---

## Key Features

1. **Autonomous Tool Calling**:
   - Uses native Gemini function calling (`@google/genai`) to execute multi-step tool calls in a single turn.
2. **Unified Diff Approval System**:
   - Every file modification produces standard unified diffs (`@@ -l,s +l,s @@`) with syntax colorization before applying.
   - User choices: `y` (approve), `n` (reject), `a` (approve all subsequent changes for this session).
3. **Reversible History (`/undo` & `/redo`)**:
   - Every accepted file edit, write, move, or deletion is recorded in an in-memory stack and persisted to `.agent/history/`.
   - Run `/undo` to instantly revert the last change.
4. **Command Safety & Allow/Denylist**:
   - Classifies commands into `SAFE`, `LOW_RISK`, `HIGH_RISK`, and `DESTRUCTIVE`.
   - Windows and Unix patterns prevent dangerous commands (`rm -rf`, `rmdir /s`, `format`, `shutdown`, `git reset --hard`) from running without explicit confirmation.
   - Configurable allowlist/denylist via `.agent/config.json`.
5. **Real Code Search**:
   - Regex or exact text search with surrounding context lines, file extension filters, and automatic exclusion of `node_modules`, `.git`, and build folders.
6. **Path Traversal & Secret Protection**:
   - Workspace boundary enforcement (`../` and absolute paths outside root are blocked).
   - Never reads or exposes `.env`, private keys (`.pem`, `id_rsa`), or binary assets (`.png`, `.zip`, `.exe`).
   - Redacts secrets from logs and terminal output.
7. **Large File Pagination**:
   - Supports `startLine`, `endLine`, `maxLines`, and `maxChars` to prevent context explosion.
8. **Automated Verification & Repair**:
   - Detects test scripts (`npm test`, `pytest`, `cargo test`, `node --check`) and verifies changes post-edit.
9. **Planning Mode (`/plan`)**:
   - Inspects the codebase and produces an architectural plan without modifying files.

---

## Installation & Setup

### Prerequisites
- Node.js 18+ (CommonJS)
- A Google Gemini API Key

### Installation

```bash
git clone <repo-url>
cd my-ai-agent
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
LOG_LEVEL=info
```

Optional: Configure `.agent/config.json`:

```json
{
  "model": "gemini-3.8-flash",
  "maxIterations": 30,
  "maxRepairAttempts": 3,
  "maxFileSize": 100000,
  "maxSearchResults": 50,
  "commandTimeout": 30000,
  "allowCommands": ["npm", "node", "git", "npx", "dir", "ls"],
  "denyCommands": ["format", "shutdown", "diskpart"]
}
```

---

## Usage

Start the agent:

```bash
npm start
```

### Interactive CLI

```
╭──────────────────────────────────────────────────╮
│               MY AI CODING AGENT                 │
│       Autonomous Cursor-like Engineering Agent   │
╰──────────────────────────────────────────────────╯
Model:     gemini-3.8-flash
Workspace: C:/projects/my-ai-agent
Type /help for available commands or exit to quit.

You: Fix the authentication token expiration bug
```

---

## Slash Commands

All slash commands run locally without consuming API tokens:

| Command | Description |
|---|---|
| `/help` | Display list of available commands |
| `/plan <task>` | Formulate a detailed engineering plan without modifying files |
| `/undo` | Revert the most recent approved file modification |
| `/redo` | Re-apply the last undone file modification |
| `/history` | Show the file modification audit history for this session |
| `/diff` | Display uncommitted Git diff |
| `/status` | View agent memory, active model, and session state |
| `/tree` | Display project file hierarchy |
| `/model [name]` | View or switch the active Gemini model |
| `/context` | Inspect working memory and conversation size |
| `/compact` | Manually compress older tool results |
| `/test` | Run the project's test suite |
| `/lint` | Run the project's linter |
| `/build` | Run the project's build script |
| `/git <status\|diff\|log>` | Run quick Git inspection commands |
| `/reset` | Clear conversation history and reset approvals |
| `/clear` | Clear the terminal screen |
| `/exit` | Exit the CLI |

---

## Available Tools for Gemini

| Tool | Purpose |
|---|---|
| `listFiles` | List directory contents safely |
| `getProjectStructure` | Retrieve project file tree excluding dependencies |
| `analyzeProject` | Detect language, framework, dependencies, and test commands |
| `readFile` | Read file with line-range pagination and size guards |
| `searchCode` | Regex and exact text search with context lines |
| `writeFile` | Create or overwrite files with unified diff preview |
| `editFile` | Targeted text replacement with exact unique snippet check |
| `deleteFile` | Safely remove files with approval and undo backup |
| `moveFile` | Move or rename files |
| `getFileInfo` | Get file metadata (size, lines, modified date) without reading content |
| `runCommand` | Run terminal commands with exit codes, timeout, and safety validation |
| `gitStatus` | Inspect modified, staged, and untracked files |
| `gitDiff` | Inspect uncommitted changes |
| `gitLog` | Inspect recent commit history |
| `gitBranch` | Check current branch and available branches |
| `gitShow` | Show commit details and patch |
| `gitBlame` | Annotate line-by-line author and commit info |

---

## Testing

Run the automated test suite:

```bash
npm test
```

Run the end-to-end integration test:

```bash
node test/e2eTest.js
```

---

## Technology Stack

- **Runtime**: Node.js (CommonJS, JavaScript)
- **AI Model**: Google Gemini (`@google/genai`)
- **File Matching**: `glob`
- **Configuration**: `dotenv`, `.agent/config.json`
- **Diff Engine**: Custom LCS-based Unified Diff with hunks & ANSI formatting
- **Test Runner**: Custom zero-dependency test framework (`test/runTests.js`)

---

## License

ISC
