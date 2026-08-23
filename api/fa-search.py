from http.server import BaseHTTPRequestHandler
import hashlib, json, os, re, time, unicodedata
import python_filmaffinity

MIN_ACCEPT_SCORE = 45

def norm(value):
    s = unicodedata.normalize('NFD', str(value or ''))
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def as_year(value):
    try: return int(value)
    except Exception: return None

def title_score(candidate, requested):
    c, r = norm(candidate), norm(requested)
    if not c or not r: return 0
    if c == r: return 70
    if c.startswith(r) or r.startswith(c): return 56
    if r in c or c in r: return 44
    ct, rt = set(c.split()), set(r.split())
    if not ct or not rt: return 0
    return int(round((len(ct & rt) / max(len(ct), len(rt))) * 40))

def score(movie, titles, year):
    t = max([title_score(c, w) for w in titles for c in [movie.get('title'), movie.get('original_title')]] or [0])
    cy = as_year(movie.get('year')); y = 0
    if year and cy:
        d = abs(cy - year)
        y = 30 if d == 0 else 14 if d == 1 else -25
    return t + y

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        expected = hashlib.sha256(str(os.environ.get('DATABASE_URL', '')).encode()).hexdigest()
        if not expected or self.headers.get('x-pikofilm-worker') != expected:
            return self._send(401, {'ok': False, 'error': 'unauthorized'})
        try:
            length = int(self.headers.get('content-length') or '0')
            payload = json.loads(self.rfile.read(length) or b'{}')
        except Exception:
            return self._send(400, {'ok': False, 'error': 'invalid_json'})

        titles = []
        for value in [payload.get('original_title'), payload.get('title_es'), payload.get('title')]:
            value = str(value or '').strip()
            if value and norm(value) not in [norm(x) for x in titles]: titles.append(value)
        titles = titles[:2]
        year = as_year(payload.get('year'))
        if not titles: return self._send(400, {'ok': False, 'error': 'missing_title'})

        started = time.perf_counter()
        try:
            service = python_filmaffinity.FilmAffinity(lang='es', cache_backend='memory')
            found = {}; queries = []
            for title in titles:
                kwargs = {'title': title}
                if year:
                    kwargs['from_year'] = str(year - 1); kwargs['to_year'] = str(year + 1)
                queries.append({'title': title, 'from_year': kwargs.get('from_year'), 'to_year': kwargs.get('to_year')})
                rows = service.search(**kwargs) or []
                for movie in rows[:12]:
                    fa_id = str(movie.get('id') or '').strip()
                    if not fa_id.isdigit(): continue
                    sc = score(movie, titles, year)
                    cand = {'id': fa_id, 'title': movie.get('title'), 'original_title': movie.get('original_title'), 'year': as_year(movie.get('year')), 'score': sc}
                    if fa_id not in found or sc > found[fa_id]['score']: found[fa_id] = cand
                if found and max(x['score'] for x in found.values()) >= 100: break

            ranked = sorted(found.values(), key=lambda x: x['score'], reverse=True)
            if not ranked:
                return self._send(200, {'ok': True, 'status': 'not_found', 'fa_id': None, 'confidence': 0, 'queries': queries, 'candidates': [], 'elapsed_s': round(time.perf_counter() - started, 3)})

            best = ranked[0]; second = ranked[1]['score'] if len(ranked) > 1 else 0; margin = best['score'] - second
            if best['score'] < MIN_ACCEPT_SCORE:
                return self._send(200, {'ok': True, 'status': 'ambiguous', 'fa_id': None, 'best_fa_id': best['id'], 'confidence': best['score'], 'margin': margin, 'candidates': ranked[:5], 'queries': queries, 'elapsed_s': round(time.perf_counter() - started, 3)})

            verified = service.get_movie(id=best['id'])
            vscore = score(verified, titles, year) if isinstance(verified, dict) else 0
            vy = as_year(verified.get('year')) if isinstance(verified, dict) else None
            if not isinstance(verified, dict) or vscore < MIN_ACCEPT_SCORE or (year and vy and abs(vy - year) > 1):
                return self._send(200, {'ok': True, 'status': 'ambiguous', 'fa_id': None, 'best_fa_id': best['id'], 'confidence': vscore, 'margin': margin, 'candidates': ranked[:5], 'queries': queries, 'verified': {'id': best['id'], 'title': verified.get('title') if isinstance(verified, dict) else None, 'original_title': verified.get('original_title') if isinstance(verified, dict) else None, 'year': vy}, 'elapsed_s': round(time.perf_counter() - started, 3)})

            status = 'exact' if vscore >= 100 else 'high' if vscore >= 70 else 'probable'
            return self._send(200, {'ok': True, 'status': status, 'fa_id': best['id'], 'confidence': vscore, 'margin': margin, 'candidates': ranked[:5], 'queries': queries, 'verified': {'id': best['id'], 'title': verified.get('title'), 'original_title': verified.get('original_title'), 'year': vy}, 'elapsed_s': round(time.perf_counter() - started, 3)})
        except Exception as exc:
            message = str(exc); low = message.lower()
            blocked = any(x in low for x in ['429', '403', 'too many requests', 'captcha', 'blocked'])
            return self._send(502, {'ok': False, 'status': 'blocked' if blocked else 'error', 'fa_id': None, 'error': message[:300], 'elapsed_s': round(time.perf_counter() - started, 3)})

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
