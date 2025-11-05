"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function activate(context) {
    const goToTests = vscode.commands.registerCommand('goToTests.open', async (resource) => {
        const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
        if (!uri) {
            vscode.window.showInformationMessage('No file selected');
            return;
        }
        if (uri.scheme !== 'file') {
            vscode.window.showInformationMessage('Resource must be a file on disk');
            return;
        }
        const config = vscode.workspace.getConfiguration();
        const targetFolder = config.get('goToTests.targetFolderName', 'tests');
        const createIfMissing = config.get('goToTests.createIfMissing', true);
        const preferredSuffix = config.get('goToTests.preferredSuffix', '.test');
        const filePath = uri.fsPath;
        const candidates = computeCandidatePaths(filePath, targetFolder, preferredSuffix);
        const existing = await filterExistingUris(candidates);
        let toOpen;
        if (existing.length === 1) {
            toOpen = existing[0];
        }
        else if (existing.length > 1) {
            const picked = await vscode.window.showQuickPick(existing.map((uri) => ({
                label: path.basename(uri.fsPath),
                description: vscode.workspace.asRelativePath(uri),
                uri,
            })), { title: 'Select file', placeHolder: 'Matching file(s) found' });
            toOpen = picked?.uri;
        }
        else {
            if (!createIfMissing) {
                await vscode.window.showWarningMessage('No matching file found and auto-create is disabled.');
                return;
            }
            const newUri = candidates[0];
            const newDir = vscode.Uri.file(path.dirname(newUri.fsPath));
            try {
                await vscode.workspace.fs.createDirectory(newDir);
                await vscode.workspace.fs.writeFile(newUri, new Uint8Array());
                toOpen = newUri;
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed creating file: ${String(err)}`);
                return;
            }
        }
        if (toOpen) {
            await vscode.window.showTextDocument(toOpen, { preview: false });
        }
    });
    context.subscriptions.push(goToTests);
}
function computeCandidatePaths(sourceFileFsPath, targetFolderName, preferredSuffix) {
    const ext = path.extname(sourceFileFsPath);
    const fileName = path.basename(sourceFileFsPath, ext);
    const dir = path.dirname(sourceFileFsPath);
    const segments = dir.split(path.sep);
    const srcIdx = segments.lastIndexOf('src');
    const targetIdx = segments.lastIndexOf(targetFolderName);
    const goingToSource = targetIdx !== -1 && (srcIdx === -1 || targetIdx > srcIdx);
    if (goingToSource) {
        // Replace target folder with 'src' and strip test suffix
        const replaced = [...segments];
        replaced[targetIdx] = 'src';
        const baseDir = replaced.join(path.sep);
        const baseName = fileName.replace(/\.(test|spec)$/u, '');
        const candidates = [
            vscode.Uri.file(path.join(baseDir, `${baseName}${ext}`)),
        ];
        return candidates;
    }
    // Going to tests
    const replaced = [...segments];
    if (srcIdx !== -1) {
        replaced[srcIdx] = targetFolderName;
    }
    const baseDir = replaced.join(path.sep);
    const suffixes = Array.from(new Set([preferredSuffix, '.test', '.spec', ''])).filter(Boolean);
    const candidates = [];
    for (const suffix of suffixes) {
        const testBaseName = fileName.endsWith('.test') || fileName.endsWith('.spec')
            ? fileName
            : `${fileName}${suffix}`;
        candidates.push(vscode.Uri.file(path.join(baseDir, `${testBaseName}${ext}`)));
    }
    return candidates;
}
async function filterExistingUris(uris) {
    const existing = [];
    await Promise.all(uris.map(async (uri) => {
        try {
            await vscode.workspace.fs.stat(uri);
            existing.push(uri);
        }
        catch {
            // ignore
        }
    }));
    return existing;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map