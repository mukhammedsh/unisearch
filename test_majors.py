import json
data = json.load(open('backend/data/universities.json', encoding='utf-8'))
for u in data:
    for c in u.get('admission_categories', []):
        majors = c.get('applicable_majors')
        programs = c.get('program_names')
        profile_majors = [p.get('applicable_majors') for p in c.get('requirement_profiles', []) if p.get('applicable_majors')]
        profile_programs = [p.get('program_names') for p in c.get('requirement_profiles', []) if p.get('program_names')]
        if majors or programs or profile_majors or profile_programs:
            print(f"{u['id']} -> {c['id']}: majors={majors} programs={programs} p_majors={profile_majors} p_progs={profile_programs}")
