from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
import hashlib,json,os,time,re
import psycopg
import python_filmaffinity

def authorized(headers,query):
    db_url=str(os.environ.get('DATABASE_URL',''))
    if not db_url:
        return False
    expected=hashlib.sha256(db_url.encode()).hexdigest()
    supplied=str(headers.get('x-pikofilm-worker') or '').strip()
    if supplied and supplied==expected:
        return True
    job_id=str(headers.get('x-pikofilm-job-id') or '').strip()
    job_token=str(headers.get('x-pikofilm-job-token') or '').strip()
    imdb_id=str((query.get('imdb_id') or [''])[0]).strip()
    if not(job_id.isdigit() and len(job_token)>=20 and re.fullmatch(r'tt\d+',imdb_id)):
        return False
    try:
        with psycopg.connect(db_url,connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 1 FROM batch_jobs
                    WHERE id=%s AND idempotency_key=%s AND entity_id=%s
                      AND stage='IDENTITY_VALIDATION'
                      AND status IN ('leased','running')
                      AND leased_until IS NOT NULL
                      AND leased_until > now() - interval '30 seconds'
                      AND worker_id LIKE 'lifecycle-%%'
                    LIMIT 1
                """,(int(job_id),job_token,imdb_id))
                return cur.fetchone() is not None
    except Exception as exc:
        print(f'[fa-evidence-auth] database validation failed: {type(exc).__name__}: {str(exc)[:180]}')
        return False

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query=parse_qs(urlparse(self.path).query)
        if not authorized(self.headers,query):
            return self._send(401,{'ok':False,'error':'unauthorized'})
        fa_id=(query.get('id') or [''])[0].strip()
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
