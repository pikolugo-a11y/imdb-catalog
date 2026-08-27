const ABS_MIN={genre:30,country:20,decade:25,score:25};
export function eligibleRows(rows=[],dimension='genre'){
  const clean=rows.filter(r=>Number(r?.total||0)>0);
  if(!clean.length)return[];
  const max=Math.max(...clean.map(r=>Number(r.total||0)),1);
  const relative=dimension==='country'?.01:dimension==='decade'?.03:.015;
  const threshold=Math.max(ABS_MIN[dimension]||20,Math.ceil(max*relative));
  return clean.filter(r=>Number(r.total||0)>=threshold);
}
export function mostCovered(rows=[],dimension='genre'){
  return [...eligibleRows(rows,dimension)].sort((a,b)=>Number(b.coverage||0)-Number(a.coverage||0)||Number(b.total||0)-Number(a.total||0))[0]||null;
}
export function leastCovered(rows=[],dimension='genre'){
  return [...eligibleRows(rows,dimension)].sort((a,b)=>Number(a.coverage||0)-Number(b.coverage||0)||Number(b.total||0)-Number(a.total||0))[0]||null;
}
export function bestScore(rows=[],dimension='genre'){
  return [...eligibleRows(rows,dimension)].filter(r=>r.avg_score!=null).sort((a,b)=>Number(b.avg_score)-Number(a.avg_score)||Number(b.total||0)-Number(a.total||0))[0]||null;
}
