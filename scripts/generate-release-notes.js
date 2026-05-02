const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
const packageJsonPath = path.join(repoRoot, 'package.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--version') {
      args.version = argv[i + 1];
      i += 1;
    } else if (arg === '--output') {
      args.output = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function getVersion() {
  const args = parseArgs(process.argv);
  if (args.version) {
    return { version: args.version, output: args.output || null };
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return { version: packageJson.version, output: args.output || null };
}

function getFallbackNotes(version) {
  return [
    `## WeaveGraph ${version} / 人脈織圖 ${version}`,
    '',
    '### Chinese / 中文',
    '- 此版本已包含 Windows 安裝包、便攜 zip 與自動更新所需 metadata。',
    '- 詳細更新內容請參閱倉庫中的 CHANGELOG.md。',
    '',
    '### English',
    '- This release includes the Windows installer, portable zip, and auto-update metadata.',
    '- Please see CHANGELOG.md in the repository for full details.'
  ].join('\n');
}

function extractVersionNotes(changelog, version) {
  const headingPattern = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\] - .*$`, 'm');
  const match = changelog.match(headingPattern);
  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index;
  const rest = changelog.slice(start);
  const nextHeadingIndex = rest.slice(match[0].length).search(/\n## \[/);
  const end = nextHeadingIndex === -1 ? changelog.length : start + match[0].length + nextHeadingIndex + 1;
  return changelog.slice(start, end).trim();
}

function main() {
  const { version, output } = getVersion();
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const notes = extractVersionNotes(changelog, version) || getFallbackNotes(version);

  if (output) {
    fs.writeFileSync(path.resolve(repoRoot, output), `${notes}\n`, 'utf8');
  } else {
    process.stdout.write(`${notes}\n`);
  }
}

main();
