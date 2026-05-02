const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const publishConfig = packageJson.build && packageJson.build.publish ? packageJson.build.publish : {};
const owner = publishConfig.owner;
const repo = publishConfig.repo;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tag') {
      args.tag = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function getToken() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${text}`);
  }
  return response.status === 204 ? null : response.json();
}

async function main() {
  const args = parseArgs(process.argv);
  const tag = args.tag || `v${packageJson.version}`;
  const token = getToken();

  if (!owner || !repo) {
    throw new Error('Unable to resolve GitHub owner/repo from package.json build.publish.');
  }
  if (!token) {
    throw new Error('GH_TOKEN or GITHUB_TOKEN is required to sync release notes.');
  }

  const notes = execFileSync(process.execPath, [path.join(__dirname, 'generate-release-notes.js'), '--version', tag.replace(/^v/, '')], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'weavegraph-release-sync'
  };

  const release = await request(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
    method: 'GET',
    headers
  });

  await request(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: notes
    })
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
