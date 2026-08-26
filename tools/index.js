const {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile,
    editFile
} = require("./fileTools");

const { runCommand } = require("./terminalTools");

const tools = {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile,
    editFile,
    runCommand
};

module.exports = tools;