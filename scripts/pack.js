const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const outFile = `${pkg.name}-${pkg.version}.tgz`;
const root = path.join(__dirname, '..');

if (fs.existsSync(path.join(root, outFile))) {
  fs.unlinkSync(path.join(root, outFile));
}

const files = [
  'package.json',
  'package-lock.json',
  'README.md',
  'icon.png',
];

function addDir(dir) {
  const entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  for (const entry of entries) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      addDir(rel);
    } else {
      files.push(rel);
    }
  }
}
addDir('build');

const fileArgs = files.map(f => `"${f}"`).join(' ');
execSync(`tar -czf ${outFile} ${fileArgs}`, { cwd: root, stdio: 'inherit' });

console.log(`\nCreated ${outFile} (${files.length} files, flat paths)`);
