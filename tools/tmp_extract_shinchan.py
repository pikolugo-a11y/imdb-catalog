from pathlib import Path
import re
import requests
from bs4 import BeautifulSoup
import pandas as pd

URL='https://es.wikipedia.org/wiki/Anexo:Episodios_de_Crayon_Shin-chan'
out=Path('/tmp/shinchan-out'); out.mkdir(parents=True,exist_ok=True)
r=requests.get(URL,headers={'User-Agent':'PikoFilm/1.0 (personal catalog data audit)'},timeout=60)
r.raise_for_status(); (out/'source.html').write_bytes(r.content)
soup=BeautifulSoup(r.text,'lxml')
rows=[]
for h in soup.select('h2'):
    m=re.search(r'Episodios de (20\d\d|19\d\d)',h.get_text(' ',strip=True))
    if not m: continue
    year=int(m.group(1)); table=h.find_next('table')
    if table is None: continue
    current_group=current_jp_date=''
    for tr in table.select('tr'):
        cells=[c.get_text(' ',strip=True) for c in tr.find_all(['td','th'],recursive=False)]
        if not cells or all(x in {'','Episodio','Fecha de estreno en Japón','Título','Adaptado de','Fecha de estreno en España'} for x in cells): continue
        # Persist group/date when a row begins with the broadcast identifier. Continuation rows inherit them.
        first=cells[0] if cells else ''
        is_group=bool(re.match(r'^(?:Especial\s+\d+\s*\()?\d{3}|^Especial\s+\d+',first,re.I))
        if is_group:
            current_group=first
            current_jp_date=cells[1] if len(cells)>1 else ''
            rest=cells[2:]
        else:
            rest=cells
        if not current_group or len(rest)<2: continue
        ja=rest[0]; es=rest[1]
        tail=rest[2:]
        # Some later tables have Spain date as a dedicated final column. Detect date-like Spanish text in the tail.
        es_date=''
        for x in reversed(tail):
            if re.search(r'\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b',x,re.I) and re.search(r'\b20\d{2}\b',x):
                es_date=x; break
        marker=' '.join(rest).upper()
        explicit_no=('NO ESTRENADO EN ESPAÑA' in marker or 'NO DISTRIBUIDO EN ESPAÑA' in marker)
        rows.append({'year':year,'group':current_group,'jp_date':current_jp_date,'title_ja':ja,'title_es':es,'spain_date':es_date,'explicit_no_es':explicit_no,'raw':' | '.join(cells)})

df=pd.DataFrame(rows)
# Normalize source-level Spain evidence only; blank is unknown here, not automatically No.
df['emitted_es_source']=df.apply(lambda x:'no' if x.explicit_no_es else ('yes' if bool(str(x.spain_date).strip()) else 'unknown'),axis=1)
df.to_csv(out/'segments.csv',index=False)
# Also export pandas table diagnostics so we can validate changing table schemas by year.
summary=df.groupby('year').agg(segments=('group','size'),groups=('group','nunique'),explicit_no=('explicit_no_es','sum'),with_spain_date=('spain_date',lambda s:(s.astype(str).str.len()>0).sum())).reset_index()
summary.to_csv(out/'summary.csv',index=False)
print('segments',len(df),'groups',df.group.nunique(),'years',df.year.min(),df.year.max())
print(summary.to_string(index=False))
print(df[df.explicit_no_es].head(30).to_string(index=False))
