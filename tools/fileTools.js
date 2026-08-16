const fs = require("fs");
const { globSync } = require("glob");

const { getSafePath } = require("../workspace");


function listFiles({ directory = "." }) {

    const safeDirectory = getSafePath(directory);

    const files = fs.readdirSync(safeDirectory);

    return files;
}


function readFile({ filePath }) {

    const safePath = getSafePath(filePath);

    const content = fs.readFileSync(
        safePath,
        "utf-8"
    );

    return content;
}

function searchCode({ query }) {

    const files = globSync(
        "**/*.{js,jsx,ts,tsx,py,java,cpp,h}",
        {
            ignore: [
                "node_modules/**",
                ".git/**"
            ]
        }
    );

    const results = [];

    for (const file of files) {

        const safePath = getSafePath(file);

        const content = fs.readFileSync(
            safePath,
            "utf-8"
        );

        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {

            if (
                lines[i]
                    .toLowerCase()
                    .includes(query.toLowerCase())
            ) {

                results.push({
                    file: file,
                    line: i + 1,
                    text: lines[i].trim()
                });
            }
        }
    }

    return results;
}


function writeFile({ filePath, content }) {

    const safePath = getSafePath(filePath);

    fs.writeFileSync(
        safePath,
        content,
        "utf-8"
    );

    return `Successfully wrote to ${filePath}`;
}


module.exports = {
    listFiles,
    readFile,
    searchCode,
    writeFile
};