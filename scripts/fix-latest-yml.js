const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const buildDir = path.join(repoRoot, 'build');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const latestYmlPath = path.join(buildDir, 'latest.yml');

function getExpectedInstallerName() {
  return `人脈織圖(WeaveGraph)-${version}-win64.exe`;
}

function main() {
  if (!fs.existsSync(latestYmlPath)) {
    throw new Error('latest.yml not found in build directory.');
  }

  const installerName = getExpectedInstallerName();
  const installerPath = path.join(buildDir, installerName);

  if (!fs.existsSync(installerPath)) {
    throw new Error(`Expected installer not found: ${installerName}`);
  }

  let content = fs.readFileSync(latestYmlPath, 'utf8');
  content = content.replace(/^(\s*-\s*url:\s*).+$/m, `$1${installerName}`);
  content = content.replace(/^(path:\s*).+$/m, `$1${installerName}`);
  fs.writeFileSync(latestYmlPath, content, 'utf8');
  console.log(`[fix-latest-yml] Updated latest.yml to use ${installerName}`);
}

main();
