#!/usr/bin/env node
/**
 * Keeps the plugin manifests pinned to the package version. Run from the
 * `version` npm lifecycle so a release can never ship a hook that points at a
 * different build than the one being published.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const hooksPath = join(root, 'hooks', 'hooks.json');
const hooks = JSON.parse(readFileSync(hooksPath, 'utf8'));
hooks.hooks.Stop[0].hooks[0].command = `npx --yes nuhuh@${version} gate`;
writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n');

for (const rel of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
  const path = join(root, rel);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if ('version' in manifest) {
    manifest.version = version;
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  }
}

console.log(`plugin manifests pinned to ${version}`);
