import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const roots = ['src', 'scripts', 'public'];
const files = [];

const collect = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      collect(fullPath);
    } else if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
};

for (const root of roots) {
  collect(root);
}

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${files.length} JavaScript files.`);
