import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const [template,css,app,search,storage,rawBook,sourceDocx]=await Promise.all([
  read('index.html'),read('styles.css'),read('app.js'),read('lib/search.mjs'),read('lib/storage.mjs'),
  read('data/book.json'),fs.readFile(path.join(root,'source/Giac_Ngu_Nguon.docx')),
]);
const book=JSON.stringify(JSON.parse(rawBook)).replace(/</g,'\\u003c');
const sourceURL='data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,'+sourceDocx.toString('base64');
const withoutExports=source=>source.replace(/^export /gm,'');
const bundle=`const {createSearchIndex,searchEntries}=(()=>{\n${withoutExports(search)}\nreturn {createSearchIndex,searchEntries};\n})();\n`+
  `const {createUserStore}=(()=>{\n${withoutExports(storage)}\nreturn {createUserStore};\n})();\n`+
  app.replace(/^import .*;\r?\n/gm,'');
let html=template.replace(/\s*<link rel="manifest"[^>]*>/,'')
  .replace('<link rel="stylesheet" href="/styles.css">',`<style>${css}</style>`)
  .replace('<script type="module" src="/app.js"></script>',
    `<script>window.SLEEP_EMBEDDED_BOOK=${book};window.SLEEP_SOURCE_DOCX_URL=${JSON.stringify(sourceURL)};</script>\n`+
    `<script type="module">${bundle.replace(/<\/script/gi,'<\\/script')}</script>`)
  .replaceAll('href="/source/Giac_Ngu_Nguon.docx"',`href="${sourceURL}"`);
for(const [filename,mime] of [['icons/icon.svg','image/svg+xml'],['icons/favicon-32.png','image/png'],['icons/apple-touch-icon.png','image/png']]) {
  const bytes=await fs.readFile(path.join(root,filename));
  html=html.replaceAll('/'+filename,`data:${mime};base64,${bytes.toString('base64')}`);
}
await fs.writeFile(path.join(root,'Mo_Ung_Dung_Giac_Ngu.html'),html);
console.log('Created standalone app with embedded book, interface and source document.');
