# Go To Tests

Right-click a source file to jump to its matching test by replacing a `src` path segment with a `tests` (or `test`) segment. Also works in reverse from a test file back to `src`.

## Commands
- Go to Tests: `goToTests.open`

## Settings
- `goToTests.targetFolderName` (default: `tests`)
- `goToTests.preferredSuffix` (default: `.test`)
- `goToTests.createIfMissing` (default: `true`)

## Build & Package
```
npm install
npm run build
npm run package
```
This produces a `.vsix` in this folder.




