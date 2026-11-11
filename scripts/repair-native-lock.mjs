// Restore exact native variants declared by locked parent packages (npm/cli#4828).
import fs from 'node:fs';
const filename = 'package-lock.json';
const lock = JSON.parse(fs.readFileSync(filename, 'utf8'));
const variants = new Map();
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!['node_modules/next', 'node_modules/lightningcss', 'node_modules/@tailwindcss/oxide'].includes(path)) continue;
  for (const [name, version] of Object.entries(entry.optionalDependencies || {})) {
    if (!lock.packages['node_modules/'+name]) variants.set(name, version);
  }
}
if (process.argv.includes('--check')) {
  if (variants.size) { console.error('Missing native lock records:', [...variants.keys()].join(', ')); process.exit(1); }
  console.log('All declared native variants are locked.');
  process.exit(0);
}
for (const [name, version] of variants) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Native version must be exact: '+name);
  const response = await fetch('https://registry.npmjs.org/'+encodeURIComponent(name)+'/'+version);
  if (!response.ok) throw new Error('Registry metadata unavailable: '+name+' '+response.status);
  const metadata = await response.json();
  if (metadata.version !== version || !metadata.dist?.integrity || !metadata.dist.tarball.startsWith('https://registry.npmjs.org/')) throw new Error('Unexpected registry metadata: '+name);
  if (Object.keys(metadata.dependencies || {}).length) throw new Error('Review native package subdependencies: '+name);
  const entry = {version, resolved:metadata.dist.tarball, integrity:metadata.dist.integrity, optional:true};
  for (const key of ['cpu','os','libc','engines','license','funding']) if (metadata[key]) entry[key] = metadata[key];
  lock.packages['node_modules/'+name] = entry;
  console.log('Restored native lock record:',name,version);
}
lock.packages = Object.fromEntries(Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b,'en')));
fs.writeFileSync(filename, JSON.stringify(lock,null,2)+'\n');
