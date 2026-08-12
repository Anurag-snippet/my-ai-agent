const fs = require("fs");

function listFiles({ directory = "." }) {
    const files = fs.readdirSync(directory);

    return files;
}

function readFile({ filePath }) {
    const content = fs.readFileSync(filePath, "utf-8");

    return content;
}

module.exports = {
    listFiles,
    readFile
};