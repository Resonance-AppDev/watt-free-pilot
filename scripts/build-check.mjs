import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('public');
for(const file of ['index.html','workspace/index.html','legal/index.html','assets/site.css','assets/core.js','assets/workspace.js','robots.txt']){
 const target=path.resolve(root,file);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).size)throw new Error('Missing artifact '+file);
}
const html=fs.readFileSync(path.resolve(root,'workspace/index.html'),'utf8');
for(const ref of ['/assets/site.css','/assets/workspace.js'])if(!html.includes(ref))throw new Error('Missing dependency '+ref);
console.log('WATT static build: seven required public files present; no npm dependency installation necessary.');
