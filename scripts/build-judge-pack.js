#!/usr/bin/env node
/**
 * Build script for WinCon Judge Pack
 * Creates a distributable ZIP that judges can run with zero installs.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RELEASE_DIR = join(ROOT, 'release', 'WinCon_JudgePack');
const APP_DIR = join(RELEASE_DIR, 'app');

function log(msg) {
  console.log(`[build-judge-pack] ${msg}`);
}

function run(cmd, cwd = ROOT) {
  log(`Running: ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function cleanDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

async function main() {
  log('Starting Judge Pack build...');

  // Step 1: Build TypeScript
  log('Step 1: Building TypeScript...');
  run('npm run build');

  // Step 2: Create release directory structure
  log('Step 2: Creating release directory structure...');
  cleanDir(APP_DIR);
  mkdirSync(join(RELEASE_DIR, 'runtime'), { recursive: true });
  mkdirSync(join(RELEASE_DIR, 'logs'), { recursive: true });

  // Step 3: Copy dist/ to app/dist/
  log('Step 3: Copying compiled JavaScript...');
  cpSync(join(ROOT, 'dist'), join(APP_DIR, 'dist'), { recursive: true });

  // Step 4: Create minimal package.json with only runtime deps
  log('Step 4: Creating minimal package.json...');
  const minimalPackage = {
    name: 'wincon-judgepack',
    version: '1.0.0',
    type: 'module',
    main: 'dist/index.js',
    dependencies: {
      'ink': '^4.4.1',
      'ink-select-input': '^5.0.0',
      'ink-text-input': '^5.0.1',
      'ink-spinner': '^5.0.0',
      'react': '^18.2.0',
      'zustand': '^4.4.7',
      'chalk': '^5.3.0',
      'dotenv': '^16.3.1'
    }
  };
  writeFileSync(
    join(APP_DIR, 'package.json'),
    JSON.stringify(minimalPackage, null, 2)
  );

  // Step 5: Install production dependencies
  log('Step 5: Installing production dependencies (this may take a moment)...');
  run('npm install --omit=dev', APP_DIR);

  // Step 6: Copy data/raw/ to app/data/raw/
  log('Step 6: Copying data files...');
  mkdirSync(join(APP_DIR, 'data', 'raw'), { recursive: true });
  const rawDir = join(ROOT, 'data', 'raw');
  if (existsSync(rawDir)) {
    cpSync(rawDir, join(APP_DIR, 'data', 'raw'), { recursive: true });
  } else {
    log('Warning: data/raw/ not found, skipping...');
  }

  // Step 7: Create empty demo cache directory
  log('Step 7: Creating demo cache directory...');
  mkdirSync(join(APP_DIR, 'data', 'cache', 'demo'), { recursive: true });

  // Step 8: Create README_JUDGES.txt
  log('Step 8: Creating README_JUDGES.txt...');
  const readme = `WinCon Judge Pack - Quick Start
================================
1. Extract entire folder to your Desktop
2. Double-click "Run WinCon (Demo).bat"
3. Use arrow keys to navigate, Enter to select
4. Press 'q' to quit

Note: Demo mode uses pre-cached data (no internet required).
For live data, configure .env and use "Run WinCon (Live).bat".

Questions? Contact the WinCon team.
`;
  writeFileSync(join(RELEASE_DIR, 'README_JUDGES.txt'), readme);

  // Step 9: Print Node.js download instructions
  log('');
  log('========================================');
  log('BUILD COMPLETE!');
  log('========================================');
  log('');
  log('MANUAL STEPS REQUIRED:');
  log('');
  log('1. Download Node.js portable:');
  log('   https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip');
  log('');
  log('2. Extract node.exe (~70 MB) to:');
  log(`   ${join(RELEASE_DIR, 'runtime', 'node.exe')}`);
  log('');
  log('3. Populate demo cache files in:');
  log(`   ${join(APP_DIR, 'data', 'cache', 'demo')}`);
  log('');
  log('4. Create ZIP: WinCon_JudgePack.zip');
  log('');
  log('Package location:');
  log(`   ${RELEASE_DIR}`);
  log('');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
