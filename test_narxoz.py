import json
with open('backend/data/universities.json', encoding='utf-8') as f:
    data = json.load(f)
u = next(x for x in data if x['id'] == 'narxoz-university-kaz-almaty')
for c in u.get('admission_categories', []):
    for p in c.get('requirement_profiles', []):
        print(f"Profile {p.get('id')}: majors={p.get('applicable_majors')} programs={p.get('program_names')}")
