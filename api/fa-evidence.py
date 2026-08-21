from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
import hashlib,json,os,time
import python_filmaffinity

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        expected=hashlib.sha256(str(os.environ.get('DATABASE_URL','')).encode()).hexdigest()
        if not expected or self.headers.get('x-pikofilm-worker')!=expected:
            return self._send(401,{'ok':False,'error':'unauthorized'})
        fa_id=(parse_qs(urlparse(self.path).query).get('id') or [''])[0].strip()
        if not fa_id.isdigit():
            return self._send(400,{'ok':False,'error':'invalid_fa_id'})
        t=time.perf_counter()
        try:
            service=python_filmaffinity.FilmAffinity(lang='es',cache_backend='memory')
            m=service.get_movie(id=fa_id)
            if not isinstance(m,dict) or not m:
                raise RuntimeError('Sin datos')
            return self._send(200,{'ok':True,'fa_id':fa_id,'title':m.get('title'),'original_title':m.get('original_title'),'year':int(m.get('year')) if str(m.get('year') or '').isdigit() else None,'elapsed_s':round(time.perf_counter()-t,3)})
        except Exception as e:
            return self._send(502,{'ok':False,'fa_id':fa_id,'error':str(e),'elapsed_s':round(time.perf_counter()-t,3)})
    def _send(self,status,payload):
        body=json.dumps(payload,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)
