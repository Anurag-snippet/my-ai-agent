const {
    listFiles,
    readFile,
    searchCode,
    writeFile
} = require("./fileTools");

const { runCommand } = require("./terminalTools");

const tools = {
    listFiles,
    readFile,
    searchCode,
    writeFile,
    runCommand
};

module.exports = tools;