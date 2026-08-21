import json,sys,time,re,unicodedata
import python_filmaffinity

items=json.loads(sys.stdin.read() or '[]')
service=python_filmaffinity.FilmAffinity(lang='es',cache_backend='memory')
out=[]
consecutive_errors=0
consecutive_empty=0
MIN_ACCEPT_SCORE=45

def norm(value):
    s=unicodedata.normalize('NFD',str(value or ''))
    s=''.join(ch for ch in s if unicodedata.category(ch)!='Mn').lower()
    return re.sub(r'[^a-z0-9]+',' ',s).strip()

def as_year(value):
    try:return int(value)
    except:return None

def title_score(candidate,requested):
    c,r=norm(candidate),norm(requested)
    if not c or not r:return 0
    if c==r:return 70
    if c.startswith(r) or r.startswith(c):return 56
    if r in c or c in r:return 44
    ct,rt=set(c.split()),set(r.split())
    if not ct or not rt:return 0
    return int(round((len(ct&rt)/max(len(ct),len(rt)))*40))

def score(movie,titles,year):
    t=max([title_score(c,w) for w in titles for c in [movie.get('title'),movie.get('original_title')]] or [0])
    cy=as_year(movie.get('year')); y=0
    if year and cy:
        d=abs(cy-year)
        y=30 if d==0 else 14 if d==1 else -25
    return t+y

for item in items:
    started=time.perf_counter()
    titles=[]
    for value in [item.get('original_title'),item.get('title_es'),item.get('title')]:
        value=str(value or '').strip()
        if value and norm(value) not in [norm(x) for x in titles]:titles.append(value)
    titles=titles[:2]
    year=as_year(item.get('year'))
    try:
        found={}; queries=[]
        for title in titles:
            kwargs={'title':title}
            if year:
                kwargs['from_year']=str(year-1);kwargs['to_year']=str(year+1)
            queries.append({'title':title,'from_year':kwargs.get('from_year'),'to_year':kwargs.get('to_year')})
            rows=service.search(**kwargs) or []
            for movie in rows[:12]:
                fa_id=str(movie.get('id') or '').strip()
                if not fa_id.isdigit():continue
                sc=score(movie,titles,year)
                cand={'id':fa_id,'title':movie.get('title'),'original_title':movie.get('original_title'),'year':as_year(movie.get('year')),'score':sc}
                if fa_id not in found or sc>found[fa_id]['score']:found[fa_id]=cand
            if found and max(x['score'] for x in found.values())>=100:break
        ranked=sorted(found.values(),key=lambda x:x['score'],reverse=True)
        if not ranked:
            consecutive_empty+=1;consecutive_errors=0
            out.append({'ok':True,'status':'not_found','imdb_id':item.get('imdb_id'),'fa_id':None,'confidence':0,'queries':queries,'elapsed_s':round(time.perf_counter()-started,3)})
        else:
            consecutive_empty=0;consecutive_errors=0
            best=ranked[0]; second=ranked[1]['score'] if len(ranked)>1 else 0; margin=best['score']-second
            if best['score']<MIN_ACCEPT_SCORE:
                out.append({'ok':True,'status':'ambiguous','imdb_id':item.get('imdb_id'),'fa_id':None,'best_fa_id':best['id'],'confidence':best['score'],'margin':margin,'candidates':ranked[:5],'queries':queries,'elapsed_s':round(time.perf_counter()-started,3)})
            else:
                verified=service.get_movie(id=best['id'])
                vscore=score(verified,titles,year) if isinstance(verified,dict) else 0
                vy=as_year(verified.get('year')) if isinstance(verified,dict) else None
                if not isinstance(verified,dict) or vscore<MIN_ACCEPT_SCORE or (year and vy and abs(vy-year)>1):
                    out.append({'ok':True,'status':'ambiguous','imdb_id':item.get('imdb_id'),'fa_id':None,'best_fa_id':best['id'],'confidence':vscore,'margin':margin,'candidates':ranked[:5],'queries':queries,'elapsed_s':round(time.perf_counter()-started,3)})
                else:
                    status='exact' if vscore>=100 else 'high' if vscore>=70 else 'probable'
                    out.append({'ok':True,'status':status,'imdb_id':item.get('imdb_id'),'fa_id':best['id'],'confidence':vscore,'margin':margin,'candidates':ranked[:5],'verified':{'title':verified.get('title'),'original_title':verified.get('original_title'),'year':vy},'elapsed_s':round(time.perf_counter()-started,3)})
    except Exception as e:
        consecutive_errors+=1
        out.append({'ok':False,'status':'error','imdb_id':item.get('imdb_id'),'fa_id':None,'error':str(e)[:300],'elapsed_s':round(time.perf_counter()-started,3)})
    if consecutive_errors>=3:
        out.append({'circuit_breaker':True,'reason':'3 errores consecutivos en FilmAffinity'})
        break
    if consecutive_empty>=10:
        out.append({'circuit_breaker':True,'reason':'10 búsquedas consecutivas sin resultados en FilmAffinity','soft_block':True})
        break
    time.sleep(1.25)
print(json.dumps(out,ensure_ascii=False))
