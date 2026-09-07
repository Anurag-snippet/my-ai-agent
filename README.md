# My AI Agent

A lightweight, Cursor-like AI coding agent built with Node.js and Gemini. The project explores how modern coding agents inspect a codebase, use tools, modify files safely, run commands, and iterate based on results.

## Features

- Gemini-powered AI coding assistant
- Function calling with a tool-based agent loop
- Project structure and file inspection
- Source-code search with surrounding context
- Targeted file editing
- File creation and replacement
- Workspace path isolation to prevent access outside the project
- Diff generation before code changes
- Human approval for file modifications
- Basic command safety checks
- Terminal command execution for testing and verification
- Streaming model responses
- Multi-step tool execution

## Tech Stack

- Node.js
- JavaScript
- Gemini API
- `@google/genai`
- File System APIs
- Git

## Project Structure

```text
my-ai-agent/
├── agent/
│   ├── agent.js
│   ├── prompts.js
│   ├── approval.js
│   ├── diff.js
│   └── commandSafety.js
│
├── tools/
│   ├── fileTools.js
│   ├── terminalTools.js
│   └── index.js
│
├── workspace.js
├── index.js
├── .env
├── .gitignore
├── package.json
└── package-lock.json
```

## How It Works

The agent follows a tool-calling loop:

```text
User Request
     ↓
   Gemini
     ↓
Tool Call?
  ┌──┴──┐
 No    Yes
 ↓       ↓
Final   Execute Tool
Answer     ↓
         Result
           ↓
         Gemini
           ↓
      Continue / Finish
```

For a coding task, the agent can inspect the project, read relevant files, search for code, propose a change, request approval, apply the change, run a verification command, and use the result to continue working.

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Anurag-snippet/my-ai-agent.git
cd my-ai-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the Gemini API key

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_api_key_here
```

Never commit your API key. The `.env` file should remain ignored by Git.

### 4. Run the agent

```bash
node index.js
```

Then enter a coding request. Use `exit` to close the CLI.

## Available Tools

| Tool | Purpose |
|---|---|
| `listFiles` | Inspect files in a directory |
| `getProjectStructure` | Get the overall project file structure |
| `readFile` | Read a file |
| `searchCode` | Search source code and return matching context |
| `writeFile` | Create or replace a file |
| `editFile` | Make a targeted edit to an existing file |
| `runCommand` | Run terminal commands for inspection, testing, or verification |

## Safety

The agent includes basic safeguards around file and command operations:

- File paths are restricted to the workspace.
- Existing-file edits require human approval.
- Diffs can be reviewed before changes are applied.
- Potentially destructive terminal commands are checked and may require approval.
- Tool results are returned to Gemini so it can verify whether an operation actually succeeded.

These safeguards are intended for learning and local development. They are not a complete security sandbox.

## Learning Goals

This project is built as a practical GenAI learning project to understand:

- LLM function calling
- Agent loops
- Tool registries
- Context and conversation history
- Codebase inspection
- Safe code modification
- Human-in-the-loop approval
- Command execution and verification
- Building agent systems with Node.js

## Future Improvements

- Better patch-based diff generation
- More robust command sandboxing
- Improved code search and indexing
- Automatic test selection
- Better context management for large repositories
- Planning and task decomposition
- More reliable error recovery
- Support for additional development tools

## Author

**Anurag Yadav**

- GitHub: https://github.com/Anurag-snippet
- Project: https://github.com/Anurag-snippet/my-ai-agent
