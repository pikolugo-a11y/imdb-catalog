from http.server import BaseHTTPRequestHandler
import json, time
import python_filmaffinity

IDS=[('363136','El viaje a la Luna'),('915417','El nacimiento de una nación'),('891614','Intolerancia'),('469437','Lirios rotos'),('446167','El gabinete del doctor Caligari')]

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        service=python_filmaffinity.FilmAffinity(lang='es', cache_backend='memory')
        out=[]
        for fa_id,expected in IDS:
            t=time.perf_counter()
            try:
                m=service.get_movie(id=fa_id)
                out.append({'fa_id':fa_id,'expected':expected,'ok':bool(m),'title':m.get('title') if isinstance(m,dict) else None,'original_title':m.get('original_title') if isinstance(m,dict) else None,'year':m.get('year') if isinstance(m,dict) else None,'elapsed_s':round(time.perf_counter()-t,3)})
            except Exception as e:
                out.append({'fa_id':fa_id,'expected':expected,'ok':False,'error':repr(e),'elapsed_s':round(time.perf_counter()-t,3)})
        body=json.dumps({'ok_count':sum(1 for x in out if x.get('ok')),'results':out},ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)
