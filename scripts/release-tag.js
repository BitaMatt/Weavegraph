const { execFileSync } = require('child_process');
const path = require('path');

const packageJson = require(path.join(__dirname, '..', 'package.json'));

const version = packageJson.version;
const tagName = `v${version}`;
const remoteName = 'WeaveGraph';
const shouldPublish = process.argv.includes('--publish');

function run(command, args) {
  execFileSync(command, args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function tagExists(tag) {
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore'
    });
    return true;
  } catch (error) {
    return false;
  }
}

if (tagExists(tagName)) {
  console.error(`[release-tag] Tag ${tagName} already exists. Please bump package.json version before creating a new release tag.`);
  process.exit(1);
}

console.log(`[release-tag] Creating and pushing ${tagName} to ${remoteName}...`);
run('git', ['tag', tagName]);
run('git', ['push', remoteName, tagName]);

if (shouldPublish) {
  if (!process.env.GH_TOKEN) {
    console.error('[release-tag] GH_TOKEN is required for --publish.');
    process.exit(1);
  }

  console.log('[release-tag] Publishing Windows artifacts to GitHub Releases...');
  run(npmCommand, ['run', 'publish:win']);
}
