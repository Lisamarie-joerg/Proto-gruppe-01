import json
d = json.load(open('webapp/static/data.json', encoding='utf-8'))
b = d['bars'][0]
print('bar keys:', list(b.keys()))
print('beispiel:', json.dumps(b, ensure_ascii=False)[:400])
ids = [str(x.get('beam_id')) for x in d['bars']]
print('beam_id samples:', ids[:5])
print('beam_id eindeutig:', len(set(ids)))
nrs = [x.get('nr') for x in d['bars']]
print('nr samples:', nrs[:5])
print('nr eindeutig:', len(set(map(str, nrs))))
print('gruppen:', sorted(set(x.get('gruppe') for x in d['bars'])))
print('profile:', sorted(set(x.get('profil') for x in d['bars'])))
