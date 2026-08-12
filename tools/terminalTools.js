const { execSync } = require("child_process");

function runCommand({ command }) {
    try {
        const output = execSync(command, {
            cwd: process.cwd(),
            encoding: "utf-8",
            timeout: 10000
        });

        return {
            success: true,
            output: output
        };

    } catch (error) {
        return {
            success: false,
            output: error.stdout || error.message
        };
    }
}

module.exports = {
    runCommand
};
