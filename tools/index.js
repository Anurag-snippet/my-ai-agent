const {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile
} = require("./fileTools");

const { runCommand } = require("./terminalTools");

const tools = {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile,
    runCommand
};

module.exports = tools;