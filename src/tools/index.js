// src/tools/index.js
const { Type } = require("@google/genai");

const {
  listFiles,
  readFile,
  writeFile,
  editFile,
  deleteFile,
  moveFile,
  getFileInfo,
} = require("./fileTools");

const { searchCode } = require("./searchTools");
const { runCommand } = require("./terminalTools");
const {
  gitStatus,
  gitDiff,
  gitLog,
  gitBranch,
  gitShow,
  gitBlame,
} = require("./gitTools");
const { getProjectStructure, analyzeProject } = require("./projectTools");

// Tool execution map
const tools = {
  listFiles,
  getProjectStructure,
  analyzeProject,
  readFile,
  searchCode,
  writeFile,
  editFile,
  deleteFile,
  moveFile,
  getFileInfo,
  runCommand,
  gitStatus,
  gitDiff,
  gitLog,
  gitBranch,
  gitShow,
  gitBlame,
};

// Declarations for Gemini Function Calling
const toolDeclarations = [
  {
    name: "listFiles",
    description: "Lists the files and folders inside a directory within the workspace.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory: {
          type: Type.STRING,
          description: "The directory to inspect (default: '.').",
        },
      },
    },
  },
  {
    name: "getProjectStructure",
    description: "Returns the project directory structure while ignoring build and dependency folders.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        maxDepth: {
          type: Type.INTEGER,
          description: "Max directory depth to inspect (1 to 6, default: 3).",
        },
      },
    },
  },
  {
    name: "analyzeProject",
    description: "Analyzes project tech stack, package manager, frameworks, test/build/lint scripts, and entry points.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "readFile",
    description: "Reads a file with support for line-range pagination and size limits. Never reads secrets or binaries.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "The relative path of the file to read.",
        },
        startLine: {
          type: Type.INTEGER,
          description: "Optional 1-indexed starting line number.",
        },
        endLine: {
          type: Type.INTEGER,
          description: "Optional 1-indexed ending line number.",
        },
        maxLines: {
          type: Type.INTEGER,
          description: "Maximum number of lines to return.",
        },
        maxChars: {
          type: Type.INTEGER,
          description: "Maximum character limit before truncation.",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "searchCode",
    description: "Searches project source code for a text pattern or regular expression, returning matches with surrounding context lines.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Text or regex pattern to search for.",
        },
        searchDirectory: {
          type: Type.STRING,
          description: "Directory path to constrain search within (default: '.').",
        },
        maxResults: {
          type: Type.INTEGER,
          description: "Maximum matches to return (default: 50).",
        },
        contextLines: {
          type: Type.INTEGER,
          description: "Number of surrounding context lines above and below match (default: 3).",
        },
        caseSensitive: {
          type: Type.BOOLEAN,
          description: "Whether search should be case sensitive (default: false).",
        },
        isRegex: {
          type: Type.BOOLEAN,
          description: "Whether query should be treated as a regular expression (default: false).",
        },
        fileExtension: {
          type: Type.STRING,
          description: "Optional extension filter, e.g. 'js', 'json', 'py'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "writeFile",
    description: "Creates a new file or overwrites an existing file with the provided complete content.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "Path of the file to create or replace.",
        },
        content: {
          type: Type.STRING,
          description: "Complete text content to write.",
        },
      },
      required: ["filePath", "content"],
    },
  },
  {
    name: "editFile",
    description: "Applies a targeted replacement to an existing file by substituting exact unique 'oldText' with 'newText'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "Path of the file to edit.",
        },
        oldText: {
          type: Type.STRING,
          description: "The exact existing code snippet to be replaced. Must appear exactly once.",
        },
        newText: {
          type: Type.STRING,
          description: "The replacement code snippet.",
        },
      },
      required: ["filePath", "oldText", "newText"],
    },
  },
  {
    name: "deleteFile",
    description: "Deletes a file safely from the project.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "Path of the file to delete.",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "moveFile",
    description: "Moves or renames a file from sourcePath to destinationPath.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sourcePath: {
          type: Type.STRING,
          description: "Current path of the file.",
        },
        destinationPath: {
          type: Type.STRING,
          description: "New destination path for the file.",
        },
      },
      required: ["sourcePath", "destinationPath"],
    },
  },
  {
    name: "getFileInfo",
    description: "Gets file metadata (size, lines, modified time, isBinary) without loading full content.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "Path of the file to inspect.",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "runCommand",
    description: "Executes a terminal command safely in the workspace. Returns stdout, stderr, exitCode, and duration.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: "The terminal command to execute.",
        },
        timeout: {
          type: Type.INTEGER,
          description: "Execution timeout in milliseconds (default: 30000).",
        },
        cwd: {
          type: Type.STRING,
          description: "Working directory relative to workspace root.",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "gitStatus",
    description: "Returns the current Git repository status including branch, modified, untracked, and staged files.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "gitDiff",
    description: "Returns uncommitted Git diff changes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        cached: {
          type: Type.BOOLEAN,
          description: "If true, shows staged diff (git diff --cached).",
        },
        filePath: {
          type: Type.STRING,
          description: "Optional path to limit diff to a specific file.",
        },
      },
    },
  },
  {
    name: "gitLog",
    description: "Returns recent commit history from the repository.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        count: {
          type: Type.INTEGER,
          description: "Number of recent commits to retrieve (default: 5).",
        },
      },
    },
  },
  {
    name: "gitBranch",
    description: "Lists git branches and current active branch.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "gitShow",
    description: "Shows details and patch diff of a specific commit or HEAD.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        commit: {
          type: Type.STRING,
          description: "Commit hash or ref (default: 'HEAD').",
        },
      },
    },
  },
  {
    name: "gitBlame",
    description: "Annotates line-by-line commit information for a file.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: "File path to blame.",
        },
        startLine: {
          type: Type.INTEGER,
          description: "Starting line.",
        },
        endLine: {
          type: Type.INTEGER,
          description: "Ending line.",
        },
      },
      required: ["filePath"],
    },
  },
];

module.exports = {
  tools,
  toolDeclarations,
  ...tools,
};
