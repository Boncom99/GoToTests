import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const goToTests = vscode.commands.registerCommand(
    'goToTests.open',
    async (resource?: vscode.Uri) => {
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
      const targetFolder = config.get<string>(
        'goToTests.targetFolderName',
        'tests',
      );
      const createIfMissing = config.get<boolean>(
        'goToTests.createIfMissing',
        true,
      );
      const preferredSuffix = config.get<string>(
        'goToTests.preferredSuffix',
        '.test',
      );

      const filePath = uri.fsPath;
      const candidates = computeCandidatePaths(
        filePath,
        targetFolder,
        preferredSuffix,
      );

      const existing = await filterExistingUris(candidates);
      let toOpen: vscode.Uri | undefined;

      if (existing.length === 1) {
        toOpen = existing[0];
      } else if (existing.length > 1) {
        const picked = await vscode.window.showQuickPick(
          existing.map((uri) => ({
            label: path.basename(uri.fsPath),
            description: vscode.workspace.asRelativePath(uri),
            uri,
          })),
          { title: 'Select file', placeHolder: 'Matching file(s) found' },
        );
        toOpen = picked?.uri;
      } else {
        if (!createIfMissing) {
          await vscode.window.showWarningMessage(
            'No matching file found and auto-create is disabled.',
          );
          return;
        }
        const newUri = candidates[0];
        const newDir = vscode.Uri.file(path.dirname(newUri.fsPath));
        try {
          await vscode.workspace.fs.createDirectory(newDir);
          await vscode.workspace.fs.writeFile(newUri, new Uint8Array());
          toOpen = newUri;
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed creating file: ${String(err)}`,
          );
          return;
        }
      }

      if (toOpen) {
        await vscode.window.showTextDocument(toOpen, { preview: false });
      }
    },
  );

  const goToStory = vscode.commands.registerCommand(
    'goToTests.openStory',
    async (resource?: vscode.Uri) => {
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
      const createIfMissing = config.get<boolean>(
        'goToTests.createStoryIfMissing',
        true,
      );

      const filePath = uri.fsPath;
      const candidates = computeStoryCandidatePaths(filePath);

      const existing = await filterExistingUris(candidates);
      let toOpen: vscode.Uri | undefined;

      if (existing.length === 1) {
        toOpen = existing[0];
      } else if (existing.length > 1) {
        const picked = await vscode.window.showQuickPick(
          existing.map((uri) => ({
            label: path.basename(uri.fsPath),
            description: vscode.workspace.asRelativePath(uri),
            uri,
          })),
          { title: 'Select file', placeHolder: 'Matching story file(s) found' },
        );
        toOpen = picked?.uri;
      } else {
        if (!createIfMissing) {
          await vscode.window.showWarningMessage(
            'No matching story file found and auto-create is disabled.',
          );
          return;
        }
        const newUri = candidates[0];
        const newDir = vscode.Uri.file(path.dirname(newUri.fsPath));
        try {
          await vscode.workspace.fs.createDirectory(newDir);
          await vscode.workspace.fs.writeFile(newUri, new Uint8Array());
          toOpen = newUri;
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed creating file: ${String(err)}`,
          );
          return;
        }
      }

      if (toOpen) {
        await vscode.window.showTextDocument(toOpen, { preview: false });
      }
    },
  );

  context.subscriptions.push(goToTests, goToStory);
}

function computeCandidatePaths(
  sourceFileFsPath: string,
  targetFolderName: string,
  preferredSuffix: string,
): vscode.Uri[] {
  const ext = path.extname(sourceFileFsPath);
  const fileName = path.basename(sourceFileFsPath, ext);
  const dir = path.dirname(sourceFileFsPath);

  const segments = dir.split(path.sep);
  const srcIdx = segments.lastIndexOf('src');
  const targetIdx = segments.lastIndexOf(targetFolderName);

  const goingToSource =
    targetIdx !== -1 && (srcIdx === -1 || targetIdx > srcIdx);

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

  const suffixes = Array.from(
    new Set([preferredSuffix, '.test', '.spec', '']),
  ).filter(Boolean);

  const candidates: vscode.Uri[] = [];
  for (const suffix of suffixes) {
    const testBaseName =
      fileName.endsWith('.test') || fileName.endsWith('.spec')
        ? fileName
        : `${fileName}${suffix}`;
    candidates.push(
      vscode.Uri.file(path.join(baseDir, `${testBaseName}${ext}`)),
    );
  }
  return candidates;
}

function computeStoryCandidatePaths(sourceFileFsPath: string): vscode.Uri[] {
  const ext = path.extname(sourceFileFsPath);
  const fileName = path.basename(sourceFileFsPath, ext);
  const dir = path.dirname(sourceFileFsPath);

  // Check if we're currently in a story file
  const isStoryFile = fileName.endsWith('.stories');

  if (isStoryFile) {
    // Going from story to source
    const baseName = fileName.replace(/\.stories$/u, '');
    const candidates = [
      vscode.Uri.file(path.join(dir, `${baseName}${ext}`)),
    ];
    return candidates;
  }

  // Going from source to story
  const candidates: vscode.Uri[] = [];

  // Try .stories.tsx or .stories.ts in the same directory
  candidates.push(
    vscode.Uri.file(path.join(dir, `${fileName}.stories${ext}`)),
  );

  return candidates;
}

async function filterExistingUris(uris: vscode.Uri[]): Promise<vscode.Uri[]> {
  const existing: vscode.Uri[] = [];
  await Promise.all(
    uris.map(async (uri) => {
      try {
        await vscode.workspace.fs.stat(uri);
        existing.push(uri);
      } catch {
        // ignore
      }
    }),
  );
  return existing;
}

export function deactivate() {}
