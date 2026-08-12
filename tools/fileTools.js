const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

function listFiles({ directory = "." }) {

    const files = fs.readdirSync(directory);

    return files;
}


function readFile({ filePath }) {

    const content = fs.readFileSync(filePath, "utf-8");

    return content;
}


function searchCode({ query }) {

    const files = globSync("**/*.{js,jsx,ts,tsx,py,java,cpp,h}", {
        ignore: [
            "node_modules/**",
            ".git/**"
        ]
    });

    const results = [];

    for (const file of files) {

        const content = fs.readFileSync(file, "utf-8");

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


module.exports = {
    listFiles,
    readFile,
    searchCode
};

