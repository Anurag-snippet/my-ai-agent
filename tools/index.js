const {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile,
    editFile
} = require("./fileTools");

const { runCommand } = require("./terminalTools");
const { gitStatus, gitDiff, gitLog } = require("./gitTools");

const tools = {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile,
    editFile,
    runCommand,
    gitStatus,
    gitDiff,
    gitLog
};

module.exports = tools;