const path = require("path");

const WORKSPACE_ROOT = path.resolve(process.cwd());

function getSafePath(filePath) {
    const absolutePath = path.resolve(WORKSPACE_ROOT, filePath);

    if (
        absolutePath !== WORKSPACE_ROOT &&
        !absolutePath.startsWith(WORKSPACE_ROOT + path.sep)
    ) {
        throw new Error("Access denied: path is outside the workspace.");
    }

    return absolutePath;
}

module.exports = {
    WORKSPACE_ROOT,
    getSafePath
};