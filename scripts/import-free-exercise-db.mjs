import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const appRoot = path.resolve(import.meta.dirname, '..');
const defaultRepository = path.resolve(appRoot, '..', 'Liantu-Upstreams', 'free-exercise-db');
const repository = path.resolve(process.argv[2] || process.env.LIANTU_FREE_EXERCISE_DB || defaultRepository);
const sourceJson = path.join(repository, 'dist', 'exercises.json');
const sourceImages = path.join(repository, 'exercises');
const licensePath = path.join(repository, 'LICENSE.md');
const outputJson = path.join(appRoot, 'lib', 'generated', 'free-exercise-db.json');
const outputImages = path.join(appRoot, 'public', 'exercise-db');

const [raw, license] = await Promise.all([
  readFile(sourceJson, 'utf8'),
  readFile(licensePath, 'utf8'),
]);
if (!/public domain|unlicense/i.test(license)) throw new Error('free-exercise-db license could not be verified as Unlicense/public domain');

const records = JSON.parse(raw);
if (!Array.isArray(records) || records.length < 800) throw new Error(`Expected 800+ exercises, received ${records?.length ?? 0}`);

const compact = records.map((item) => ({
  id: String(item.id),
  name: String(item.name),
  force: item.force == null ? null : String(item.force),
  level: item.level == null ? null : String(item.level),
  mechanic: item.mechanic == null ? null : String(item.mechanic),
  equipment: item.equipment == null ? null : String(item.equipment),
  primaryMuscles: Array.isArray(item.primaryMuscles) ? item.primaryMuscles.map(String) : [],
  secondaryMuscles: Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles.map(String) : [],
  instructions: Array.isArray(item.instructions) ? item.instructions.map(String) : [],
  category: item.category == null ? null : String(item.category),
  images: Array.isArray(item.images) ? item.images.map((value) => `/exercise-db/${String(value).replaceAll('\\', '/')}`) : [],
}));

await mkdir(path.dirname(outputJson), { recursive: true });
await rm(outputImages, { recursive: true, force: true });
await mkdir(outputImages, { recursive: true });
await cp(sourceImages, outputImages, {
  recursive: true,
  filter: (source) => path.extname(source).toLowerCase() !== '.json',
});
await Promise.all([
  writeFile(outputJson, `${JSON.stringify(compact)}\n`, 'utf8'),
  writeFile(path.join(outputImages, 'LICENSE.md'), license, 'utf8'),
  writeFile(path.join(outputImages, 'SOURCE.json'), `${JSON.stringify({
    repository: 'https://github.com/yuhonas/free-exercise-db',
    commit: process.env.LIANTU_FREE_EXERCISE_DB_COMMIT || 'a859101d633a01c4a1a920d6a8ce41dabba0705f',
    license: 'Unlicense',
    importedExercises: compact.length,
    importedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8'),
]);

const imageCount = compact.reduce((sum, item) => sum + item.images.length, 0);
console.log(`Imported ${compact.length} exercises and ${imageCount} image references from ${repository}`);
