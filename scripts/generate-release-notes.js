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
    `## WeaveGraph ${version} / \u4eba\u8108\u7e54\u5716 ${version} / \u4eba\u8109\u7ec7\u56fe ${version}`,
    '',
    '### \u7b80\u4f53\u4e2d\u6587',
    '- \u6b64\u7248\u672c\u5305\u542b Windows \u5b89\u88c5\u5305\u3001\u4fbf\u643a zip \u4e0e\u81ea\u52a8\u66f4\u65b0\u6240\u9700\u7684 metadata\u3002',
    '- \u5b8c\u6574\u66f4\u65b0\u5185\u5bb9\u8bf7\u67e5\u770b\u4ed3\u5e93\u4e2d\u7684 CHANGELOG.md\u3002',
    '',
    '### \u7e41\u9ad4\u4e2d\u6587',
    '- \u6b64\u7248\u672c\u5305\u542b Windows \u5b89\u88dd\u5305\u3001\u4fbf\u651c zip \u8207\u81ea\u52d5\u66f4\u65b0\u6240\u9700\u7684 metadata\u3002',
    '- \u5b8c\u6574\u66f4\u65b0\u5167\u5bb9\u8acb\u67e5\u770b\u5009\u5eab\u4e2d\u7684 CHANGELOG.md\u3002',
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
