import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'lib');
if(!fs.existsSync(root))throw new Error(`No existe el directorio a normalizar: ${root}`);

function files(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return files(full);
    return entry.isFile()&&/\.(?:js|mjs)$/.test(entry.name)?[full]:[];
  });
}

function resolveRelative(file,specifier){
  if(!specifier.startsWith('.'))return null;
  const base=path.resolve(path.dirname(file),specifier);
  if(path.extname(base))return null;
  for(const ext of ['.js','.mjs'])if(fs.existsSync(base+ext)&&fs.statSync(base+ext).isFile())return specifier+ext;
  for(const ext of ['.js','.mjs']){
    const index=path.join(base,`index${ext}`);
    if(fs.existsSync(index)&&fs.statSync(index).isFile())return `${specifier.replace(/\/$/,'')}/index${ext}`;
  }
  return null;
}

const patterns=[
  /(\bfrom\s*['"])(\.\.?\/[^'"\n]+)(['"])/g,
  /(\bimport\s*['"])(\.\.?\/[^'"\n]+)(['"])/g,
  /(\bimport\s*\(\s*['"])(\.\.?\/[^'"\n]+)(['"]\s*\))/g
];
let changedFiles=0,changedImports=0;
for(const file of files(root)){
  const original=fs.readFileSync(file,'utf8');
  let next=original;
  for(const pattern of patterns)next=next.replace(pattern,(all,prefix,specifier,suffix)=>{
    const resolved=resolveRelative(file,specifier);
    if(!resolved)return all;
    changedImports++;
    return `${prefix}${resolved}${suffix}`;
  });
  if(next!==original){fs.writeFileSync(file,next);changedFiles++}
}
console.log(JSON.stringify({type:'worker_imports_normalized',root,changed_files:changedFiles,changed_imports:changedImports}));
