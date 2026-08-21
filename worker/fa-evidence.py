import json,sys,time
import python_filmaffinity
ids=json.loads(sys.stdin.read() or '[]')
service=python_filmaffinity.FilmAffinity(lang='es',cache_backend='memory')
out=[]; consecutive=0
for item in ids:
    fa_id=str(item.get('fa_id') or '')
    t=time.perf_counter()
    try:
        m=service.get_movie(id=fa_id)
        if not isinstance(m,dict) or not m:
            raise RuntimeError('Sin datos')
        out.append({'ok':True,'fa_id':fa_id,'title':m.get('title'),'original_title':m.get('original_title'),'year':int(m.get('year')) if str(m.get('year') or '').isdigit() else None,'elapsed_s':round(time.perf_counter()-t,3)})
        consecutive=0
    except Exception as e:
        consecutive+=1
        out.append({'ok':False,'fa_id':fa_id,'error':str(e),'elapsed_s':round(time.perf_counter()-t,3)})
        if consecutive>=3:
            out.append({'circuit_breaker':True,'reason':'3 errores consecutivos en FilmAffinity'})
            break
    time.sleep(1.25)
print(json.dumps(out,ensure_ascii=False))
