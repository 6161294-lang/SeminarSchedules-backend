import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { openApiSpec } from '../src/docs/openapi';

// יוצר את קובץ openapi.json (בשורש הפרויקט ובתיקיית docs)
const json = JSON.stringify(openApiSpec, null, 2) + '\n';
const root = path.resolve(__dirname, '..');
mkdirSync(path.join(root, 'docs'), { recursive: true });
writeFileSync(path.join(root, 'openapi.json'), json);
writeFileSync(path.join(root, 'docs', 'openapi.json'), json);
console.log('נוצר openapi.json');
