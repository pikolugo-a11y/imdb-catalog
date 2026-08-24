export function transliterateBasic(input=''){
 const map={
  'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'Y','ь':'','э':'e','ю':'yu','я':'ya',
  'Α':'A','Β':'V','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'Th','Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P','Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'Ch','Ψ':'Ps','Ω':'O',
  'α':'a','β':'v','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o'
 };
 return Array.from(String(input||'')).map(c=>map[c]??c).join('');
}

export function normalizeIdentityTitle(s){
 return transliterateBasic(String(s||''))
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/\b(tv series|serie de tv|miniseries|miniserie)\b/g,' ')
  .replace(/\([^)]*\)/g,' ')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\b(the|a|an|el|la|los|las|un|una|unos|unas)\b/g,' ')
  .replace(/\s+/g,' ').trim();
}

export function titleSimilarity(a,b){
 a=normalizeIdentityTitle(a);b=normalizeIdentityTitle(b);
 if(!a&&!b)return 100;if(!a||!b)return 0;
 const m=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){let prev=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const old=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}
 return Math.round((1-m[b.length]/Math.max(a.length,b.length))*100);
}

export function validateIdentityEvidence(e){
 const io=e.imdb_original_title||null,to=e.tmdb_original_title||null;
 const sim=titleSimilarity(io,to);
 const iy=Number(e.imdb_year)||null,ty=Number(e.tmdb_year)||null,yearDelta=iy&&ty?Math.abs(iy-ty):null;
 const link=e.link_evidence||{};
 const forwardFound=Boolean(link.forward_found),forwardMatch=Boolean(link.forward_match),reverseFound=Boolean(link.reverse_imdb_id),reverseMatch=Boolean(link.reverse_match);
 const typeKnown=link.type_match!==undefined&&link.type_match!==null,typeMatch=typeKnown?Boolean(link.type_match):true;
 const contradictions=[];
 if(forwardFound&&!forwardMatch)contradictions.push(`IMDb apunta a TMDb ${link.forward_tmdb_id||'distinto'} y PikoFilm tiene ${e.tmdb_id||'otro'}`);
 if(reverseFound&&!reverseMatch)contradictions.push(`TMDb apunta a IMDb ${link.reverse_imdb_id} y PikoFilm tiene ${link.expected_imdb_id||'otro'}`);
 if(typeKnown&&!typeMatch)contradictions.push(`Tipo TMDb ${link.forward_media_type||'desconocido'} incompatible con ${link.expected_media_type||'el catálogo'}`);
 if(contradictions.length)return{status:'invalid',score:10,suspected:'tmdb',details:{validation_version:'2.0.0',explanation:'Contradicción directa entre los identificadores IMDb y TMDb',contradictions,link_evidence:link,similarity:{imdb_tmdb:sim},years:{imdb:iy,tmdb:ty,delta:yearDelta}}};
 const warnings=[];
 if(yearDelta!=null&&yearDelta>1)warnings.push(`Año difiere ${yearDelta} años`);else if(yearDelta===1)warnings.push('Año difiere ±1');
 if(io&&to&&sim<70)warnings.push(`Título original con similitud baja (${sim}%)`);
 const metadataPoints=(typeMatch?10:0)+(yearDelta===0?10:yearDelta===1?7:0)+(sim>=95?10:sim>=85?8:sim>=70?5:0);
 let score=0,status='insufficient',explanation='No hay evidencia suficiente para confirmar automáticamente la identidad';
 if(forwardMatch&&reverseMatch){score=Math.min(100,90+Math.round(metadataPoints/3));status='valid';explanation='IMDb y TMDb se confirman mutuamente mediante sus identificadores externos';}
 else if(forwardMatch){score=Math.min(90,60+metadataPoints);status=score>=85?'valid':'doubtful';explanation=status==='valid'?'IMDb resuelve directamente al TMDb almacenado y los metadatos son coherentes':'IMDb resuelve al TMDb almacenado, pero falta confirmación inversa o hay metadatos débiles';}
 else if(reverseMatch){score=Math.min(85,45+metadataPoints);status=score>=80?'doubtful':'insufficient';explanation='TMDb confirma el IMDb almacenado, pero no existe confirmación directa IMDb→TMDb';}
 else if(io&&to&&iy&&ty){score=Math.min(79,(sim>=95?50:sim>=85?42:sim>=70?32:Math.round(sim*.3))+(yearDelta===0?20:yearDelta===1?12:0)+(typeMatch?10:0));status=score>=60?'doubtful':'invalid';explanation=status==='doubtful'?'No existe vínculo directo de IDs; los metadatos coinciden razonablemente y requieren revisión prudente':'No existe vínculo directo de IDs y los metadatos no son suficientemente consistentes';}
 return{status,score:score||null,suspected:status==='invalid'?'tmdb':null,details:{validation_version:'2.0.0',explanation,warnings,link_evidence:link,similarity:{imdb_tmdb:sim},years:{imdb:iy,tmdb:ty,delta:yearDelta},metadata_points:metadataPoints}};
}
