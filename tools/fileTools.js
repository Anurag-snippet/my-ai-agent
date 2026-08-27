const fs = require("fs");
const { globSync } = require("glob");

const { getSafePath } = require("../workspace");


function listFiles({ directory = "." }) {

    const safeDirectory = getSafePath(directory);

    const files = fs.readdirSync(safeDirectory);

    return files;
}

function getProjectStructure() {
    const files = globSync("**/*", {
        ignore: [
            "node_modules/**",
            ".git/**",
            "dist/**",
            "build/**",
            ".next/**"
        ],
        nodir: true
    });
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
                ".git/**",
                "dist/**",
                "build/**",
                ".next/**"
            ],
            nodir: true
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
                const start = Math.max(0, i - 2);
                const end = Math.min(
                    lines.length,
                    i + 3
                );

                const context = [];

                for (let j = start; j < end; j++) {
                    context.push({
                        line: j + 1,
                        text: lines[j]
                    });
                }

                results.push({
                    file: file,
                    line: i + 1,
                    match: lines[i].trim(),
                    context: context
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

function editFile({ filePath, oldText, newText }) {
    const safePath = getSafePath(filePath);

    const content = fs.readFileSync(
        safePath,
        "utf-8"
    );

    const occurrences =
        content.split(oldText).length - 1;

    if (occurrences === 0) {
        throw new Error(
            "The specified oldText was not found in the file."
        );
    }

    if (occurrences > 1) {
        throw new Error(
            `The specified oldText was found ${occurrences} times. ` +
            "Please provide a more specific piece of text."
        );
    }

    const updatedContent = content.replace(
        oldText,
        newText
    );

    return {
        success: true,
        filePath,
        oldContent: content,
        newContent: updatedContent,
        safePath,
    };
}

module.exports = {
    listFiles,
    getProjectStructure,
    readFile,
    searchCode,
    writeFile,
    editFile
};
