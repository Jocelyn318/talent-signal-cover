import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const [imagePath, outputPath] = process.argv.slice(2);
if (!imagePath || !outputPath) {
  console.error('Usage: node scripts/new-project.mjs background.png output.json');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(imagePath).toLowerCase()];
if (!mime) throw new Error('Use PNG, JPEG or WebP');
if (fs.statSync(imagePath).size > 32 * 1024 * 1024) throw new Error('Image exceeds 32 MB');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'editor/seed.js'), 'utf8'), context);
const project = context.window.TALENT_SIGNAL_SEED;
project.background.src = `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;
project.name = path.basename(outputPath, path.extname(outputPath));
fs.writeFileSync(outputPath, JSON.stringify(project, null, 2) + '\n', {flag:'wx'});
console.log(path.resolve(outputPath));
