export function transliterateBasic(input=''){
 const map={
  'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
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

function bestLocalizedPair(e){
 const pairs=[
  {pair:'imdb_tmdb',score:titleSimilarity(e.imdb_title,e.tmdb_title_es)},
  {pair:'imdb_fa',score:titleSimilarity(e.imdb_title,e.fa_title_es)},
  {pair:'tmdb_fa',score:titleSimilarity(e.tmdb_title_es,e.fa_title_es)}
 ].filter(x=>Number.isFinite(x.score));
 return pairs.sort((a,b)=>b.score-a.score)[0]||{pair:null,score:0};
}

export function validateIdentityEvidence(e){
 const io=e.imdb_original_title||null,to=e.tmdb_original_title||null,fo=e.fa_original_title||null;
 const years=[e.imdb_year,e.tmdb_year,e.fa_year].map(Number);
 const simIT=titleSimilarity(io,to),simIF=titleSimilarity(io,fo),simTF=titleSimilarity(to,fo);
 const yearPair=(a,b)=>{if(!a||!b)return{score:0,delta:null,label:'sin dato'};const d=Math.abs(Number(a)-Number(b));return d===0?{score:20,delta:0,label:'exacto'}:d===1?{score:10,delta:d,label:'±1'}:{score:-20,delta:d,label:`${d} años`}};
 const yi=yearPair(e.imdb_year,e.tmdb_year),yf=yearPair(e.imdb_year,e.fa_year),ytf=yearPair(e.tmdb_year,e.fa_year);
 if(!io||!to||!fo||years.some(x=>!x))return{status:'insufficient',score:null,suspected:null,details:{explanation:'Falta título original o año en alguna de las tres fuentes',similarity:{imdb_tmdb:simIT,imdb_fa:simIF,tmdb_fa:simTF},years:{imdb_tmdb:yi,imdb_fa:yf,tmdb_fa:ytf}}};
 const localized=bestLocalizedPair(e);
 const spanishStrong=localized.score>=90;
 const exactYears=years[0]===years[1]&&years[1]===years[2];
 const strongestPair=Math.max(simIT,simIF,simTF);
 const sourceAvg={imdb:(simIT+simIF)/2,tmdb:(simIT+simTF)/2,fa:(simIF+simTF)/2};
 const rank=Object.entries(sourceAvg).sort((a,b)=>a[1]-b[1]);
 let suspected=rank[1][1]-rank[0][1]>=18?rank[0][0]:null;
 const pairWithout={imdb:simTF,tmdb:simIF,fa:simIT};
 if(suspected&&pairWithout[suspected]<82)suspected=null;
 const yearOutlier=Math.max(...years)-Math.min(...years)>1;
 const titleScore=Math.round(((simIT+simIF+simTF)/300)*60);
 const yearTotal=Math.max(-40,Math.min(40,yi.score+yf.score+ytf.score));
 const spanishBonus=spanishStrong?8:0;
 let score=Math.max(0,Math.min(100,titleScore+yearTotal+spanishBonus));
 const multilingualRescue=exactYears&&spanishStrong&&(localized.score>=95||strongestPair>=60);
 if(multilingualRescue){score=Math.max(score,90);suspected=null;}
 const crossAlphabetRescue=!multilingualRescue&&exactYears&&strongestPair>=82&&spanishStrong;
 if(crossAlphabetRescue){score=Math.max(score,88);suspected=null;}
 const severeOutlier=Boolean(suspected&&sourceAvg[suspected]<48&&pairWithout[suspected]>=88&&!crossAlphabetRescue&&!multilingualRescue);
 let status=severeOutlier?'invalid':score>=85?'valid':score>=60?'doubtful':'invalid';
 if(yearOutlier&&status==='valid')status='doubtful';
 const explanation=multilingualRescue?'Coincidencia fuerte de año y título localizado; se toleran títulos originales en otros alfabetos o variantes internacionales':crossAlphabetRescue?'Coincidencia fuerte por año y títulos; se toleran diferencias de alfabeto o transliteración':status==='valid'?'Título original y año coinciden con alta confianza en las tres fuentes':suspected?`La fuente ${suspected.toUpperCase()} se desvía de las otras dos en título original${yearOutlier?' y/o año':''}`:'Hay diferencias relevantes entre títulos originales o años';
 return{status,score,suspected,details:{explanation,similarity:{imdb_tmdb:simIT,imdb_fa:simIF,tmdb_fa:simTF},years:{imdb_tmdb:yi,imdb_fa:yf,tmdb_fa:ytf},source_average:sourceAvg,spanish_bonus:spanishBonus,cross_alphabet_rescue:crossAlphabetRescue,multilingual_rescue:multilingualRescue,localized_pair:localized}};
}
