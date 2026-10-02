"""Assemble reviewed Imperial files into a linked Stage 1 catalog, without runtime writes."""
import json
import re
import hashlib
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
EVIDENCE = ['shared-evidence.json', 'engineering-sciences-evidence.json', 'medicine-business-evidence.json', 'doctoral-evidence.json', 'course-qualification-panels.json']

def read(name):
    return json.loads(ROOT.joinpath(name).read_text(encoding='utf-8'))

def write(name, value):
    ROOT.joinpath(name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def slug(url):
    return urlsplit(url).path.rstrip('/').split('/')[-1]

def key(url):
    return re.sub(r'/20\d\d/', '/', urlsplit(url).path).rstrip('/')

bundles = {name: read(name) for name in EVIDENCE}
snapshot = read('course-search-snapshot.json')
eng = {r['source_url']: r for r in bundles[EVIDENCE[1]]['inventory_reconciliation'] if 'option_id' in r}
med = {}; med_entries = []
for r in bundles[EVIDENCE[2]].get('inventory_reconciliation', []):
    for o in r.get('study_options', []):
        if o.get('course_url'):
            med_entries.append(o)
            med.setdefault(o['course_url'], o)
sources = {}
for bundle in bundles.values():
    for s in bundle['sources']:
        if s['id'] not in sources:
            sources[s['id']] = dict(s, evidence_records=[s])
        elif s not in sources[s['id']]['evidence_records']:
            sources[s['id']]['evidence_records'].append(s)
source_by_url = {}
for s in sources.values():
    source_by_url.setdefault(key(s['url']), []).append(s['id'])
options = []; procedures = []; idmap = {}
for row in snapshot['rows']:
    oid = 'imperial-option-' + slug(row['url'])
    original = eng.get(row['url'], med.get(row['url'], {}))
    old = original.get('option_id', original.get('id'))
    if old: idmap[old] = oid
    level = 'undergraduate' if row['type'] == 'Undergraduate' else 'masters'
    internal = 'intercalated' in row['name'].lower() and row['award'] == 'PhD'
    if internal: level = 'doctoral'
    classification = 'internal_progression' if internal else 'ucas_course_choice' if level == 'undergraduate' else 'postgraduate_course_choice'
    if 'digital-health-leadership' in row['url']:
        classification = 'employer_sponsored_or_conditional_progression'
    sid = original.get('source_id')
    ids = [sid] if sid else source_by_url.get(key(row['url']), [])
    option = {'id': oid, 'title': row['name'], 'award': row['award'], 'level': level,
              'catalog_classification': classification, 'independent_application': 'A course choice or internal route as stated; not inferred from a search row or award label',
              'course_url': row['url'], 'department': original.get('department', original.get('school')),
              'cycle': '2027 entry', 'source_ids': ids, 'checked_at': '2026-10-01',
              'procedure_ids': ['procedure-' + slug(row['url'])],
              'variants': original.get('variants', row.get('variants', [])),
              'ucas_course_codes': original.get('ucas_course_codes', [])}
    options.append(option)
    procedures.append({'id': option['procedure_ids'][0], 'option_ids': [oid], 'classification': classification,
                       'destination': 'Department-approved internal progression' if internal else 'UCAS Hub; institution I50, stated course code' if level == 'undergraduate' else 'My Imperial, with course/school/scheme-specific category and conditions',
                       'shared_form_family': 'UCAS' if level == 'undergraduate' else 'My Imperial',
                       'source_ids': ids, 'policy_boundary': 'Shared form is not policy inheritance; intersect all fact scopes.'})
    option['inventory_origin'] = 'official_course_search'
    option['application_relationship'] = original.get('application_relationship', 'Course-specific choice; see scoped application evidence')
    if original.get('published_base_key_facts'):
        option['published_key_facts'] = original['published_base_key_facts']
    procedures[-1]['record_kind'] = 'application_context'
    procedures[-1]['independent_application_status'] = 'internal_only' if internal else 'published_course_choice'
    for variant in original.get('variants', []):
        vid = variant['variant_id']
        keyfacts = variant['published_variant_key_facts']
        variant_option = {'id': vid, 'title': variant['name'], 'award': keyfacts.get('award'),
                          'level': level, 'parent_option_id': oid, 'catalog_classification': 'same_page_study_variant',
                          'course_url': variant['url'], 'department': option['department'], 'cycle': option['cycle'],
                          'source_ids': [variant['source_id']], 'checked_at': variant['checked_at'],
                          'procedure_ids': list(option['procedure_ids']), 'published_key_facts': keyfacts,
                          'ucas_course_codes': variant.get('ucas_course_codes', []),
                          'application_relationship': variant['relationship_note'],
                          'independent_application_status': 'not_established_by_selector',
                          'inventory_origin': 'reviewed_course_selector'}
        options.append(variant_option)
        procedures[-1]['option_ids'].append(vid)
# School evidence includes reviewed degree entries absent from the search snapshot.
for original in med_entries:
    old = original['id']
    if old in idmap:
        continue
    parent = original.get('parent_study_option_id')
    oid = old
    idmap[old] = oid
    ids = original.get('source_ids') or source_by_url.get(key(original['course_url']), [])
    classification = original.get('application_classification', 'external_intercalated_entry' if 'intercalated_bsc_external' in old else 'researched_unresolved')
    parent_id = idmap.get(parent, parent)
    direct = original.get('direct_external_application')
    entry_point = original.get('entry_point_id')
    pid = 'procedure-' + oid
    if parent and (direct is not True or entry_point == parent):
        procedure_ids = [] if classification == 'exit_award' else next(o['procedure_ids'] for o in options if o['id'] == parent_id)
    else:
        procedure_ids = [pid]
        procedures.append({'id': pid, 'option_ids': [oid], 'classification': classification,
                           'record_kind': 'application_context', 'independent_application_status': 'published_entry_point' if direct is True else 'unresolved',
                           'destination': original.get('application_destination', 'School-specific external intercalated application; see scoped evidence'),
                           'source_ids': ids, 'policy_boundary': 'Explicit entry evidence; no inheritance from the shared portal.'})
    option = {'id': oid, 'title': original['name'], 'award': original['award'],
              'level': 'masters' if original['level'] == 'postgraduate_taught' else original['level'],
              'catalog_classification': classification, 'course_url': original['course_url'],
              'department': original.get('school'), 'source_ids': ids,
              'checked_at': original.get('checked_at', bundles[EVIDENCE[2]]['checked_at']),
              'cycle': original.get('cycle', original.get('admission_cycle', '2027 entry')), 'procedure_ids': procedure_ids,
              'inventory_origin': original.get('inventory_origin', 'reviewed_school_degree_entry'),
              'original_inventory_record': original}
    if parent_id: option['parent_option_id'] = parent_id
    options.append(option)
    if parent and (direct is not True or entry_point == parent):
        for procedure in procedures:
            if procedure['id'] in procedure_ids: procedure['option_ids'].append(oid)
doctoral = bundles[EVIDENCE[3]]
options.extend(doctoral['options']); procedures.extend(doctoral['procedures'])
# The Business MRes course-search record is the MRes phase of the documented doctoral programme.
business = next(o for o in options if o['id'] == 'imperial-option-business-mres')
old_business = business['procedure_ids'][0]
business['procedure_ids'] = ['procedure-business-doctoral']
business['catalog_classification'] = 'integrated_doctoral_mres_phase'
procedures = [p for p in procedures if p['id'] != old_business]
next(p for p in procedures if p['id'] == 'procedure-business-doctoral')['option_ids'].append(business['id'])
for procedure in doctoral['procedures']:
    procedure['record_kind'] = 'application_context'
    procedure['independent_application_status'] = 'unresolved' if procedure['application_classification'] == 'researched_unresolved' else procedure['application_classification']
fact_index = []
for name, bundle in bundles.items():
    for f in bundle['facts']:
        raw = f.get('scope', {})
        raw_ids = raw.get('option_ids', raw.get('study_option_ids', [raw['study_option_id']] if 'study_option_id' in raw else []))
        for old in raw_ids:
            if old not in idmap and old.startswith('imperial_'):
                # A school record may expose its option through the same source URL.
                urls = [sources[s]['url'] for s in f['source_ids'] if s in sources]
                match = next((o['id'] for o in options if any(key(o.get('course_url','')) == key(u) for u in urls)), None)
                if match: idmap[old] = match
        levels = raw.get('study_levels', [raw.get('study_level', 'institution')])
        levels = ['masters' if x == 'postgraduate_taught' else x for x in levels]
        fee = raw.get('fee_status', [])
        if isinstance(fee, str): fee = [fee] if fee != 'not applicable' else []
        cats = raw.get('applicant_categories', [raw.get('applicant_category', 'Specified applicant context')])
        scope = {'study_levels': levels, 'option_ids': [idmap.get(x, x) for x in raw_ids],
                 'route_ids': raw.get('route_ids', []), 'applicant_categories': cats,
                 'cycle': raw.get('cycle', raw.get('admission_cycle', 'Current guidance reviewed 2026-10-01; no cycle inferred')),
                 'fee_status': fee, 'original_scope_note': raw.get('route', ''), 'original_scope': raw}
        # Canonical scope is stored in the index; original dated dossiers are retained unchanged.
        dates = sorted({sources[s].get('checked_at', sources[s].get('verified_at')) for s in f['source_ids'] if s in sources} - {None})
        fact_index.append({'id': f['id'], 'evidence_file': name, 'topic': f['topic'], 'scope': scope,
                           'source_ids': f['source_ids'], 'content_reviewed_at': f.get('checked_at', dates[0] if dates else None),
                           'publication_status': f.get('publication_status', 'unknown'), 'review_status': f.get('review_status', 'needs_review')})
    for gap in bundle.get('researched_unknowns', []):
        if 'option_ids' in gap: gap['option_ids'] = [idmap.get(x,x) for x in gap['option_ids']]

for o in options:
    o['fact_ids'] = [f['id'] for f in fact_index if o['id'] in f['scope']['option_ids']]
runtime = next(u for u in json.loads(REPO.joinpath('backend/data/universities.json').read_text(encoding='utf-8')) if u['id'] == 'imperial-college-london-uk')
aliases = {'efds-bsc':['economics-finance-data-science'], 'aeronautical-engineering-meng':['aeronautical-engineering'],
           'mechanical-engineering-meng':['mechanical-engineering'], 'electrical-electronic-engineering-beng-meng':['electrical-electronic-engineering-beng','electrical-electronic-engineering-meng'],
           'chemical-engineering-meng':['chemical-engineering'], 'civil-engineering-meng':['civil-engineering'],
           'biomedical-engineering-beng-meng':['biomedical-engineering'],
           'mathematics-bsc-msci':['mathematics-bsc','mathematics-msci'], 'physics-bsc-msci':['physics-bsc','physics-msci'],
           'chemistry-bsc-msci':['chemistry-bsc','chemistry-msci'], 'biological-sciences-bsc':['biological-sciences'],
           'medicine-mbbs-bsc':['medicine'], 'msc-advanced-computing':['advanced-computing'], 'msc-artificial-intelligence':['artificial-intelligence'],
           'msc-financial-technology':['financial-technology'], 'msc-finance':['finance'], 'full-time-mba':['full-time-mba'],
           'msc-biomedical-engineering':['engineering-biomedicine'], 'computing-beng':['computing-beng'], 'computing-meng':['computing-meng']}
research = {'phd-computing':'computing-phd','phd-bioengineering':'bioengineering-phd','phd-physics':'physics-phd','phd-mathematics':'mathematics-phd','phd-mechanical-engineering':'mechanical-engineering-phd'}
history = []
for p in runtime['academics']['programs']:
    stem = p['id'].removeprefix('imperial-')
    targets = ['imperial-'+research[stem]] if stem in research else ['imperial-option-'+x for x in aliases.get(stem, [])]
    history.append({'runtime_id': p['id'], 'runtime_name': p['name'], 'draft_option_ids': targets,
                    'relationship': 'Legacy BEng/MEng combined row maps to the currently listed MEng; no current BEng entry is established by the reviewed inventory' if stem == 'biomedical-engineering-beng-meng' else 'Legacy combined award row expands to separate course choices where listed' if len(targets)>1 else 'Retained identity mapped to dated draft record',
                    'original_review_dates': {k:v for k,v in p.items() if 'verified_at' in k},
                    'original_provenance': {k:v for k,v in p.items() if 'source_url' in k or k=='url'},
                    'previous_facts': {k:v for k,v in p.items() if k in ['entry_requirements','tuition_status','tuition_cycle','admissions_test_notes','application_fee','deadlines']},
                    'status': 'historical_runtime_review; current draft may supersede individual facts without changing original review dates'})
write('runtime-provenance.json', {'runtime_head':'e87b5ce7906dd2c9700ce8c42dbd00f51e7c90a8','runtime_version':'7.2.1','programs':history})
write('sources.json', {'sources':list(sources.values())})
gaps = [dict(g, evidence_file=name) if isinstance(g,dict) else {'id':'gap-'+str(i)+'-'+name.removesuffix('.json'),'finding':g,'evidence_file':name,'official_next_step':'Recheck the named official policy or admission office before integration.'} for name,b in bundles.items() for i,g in enumerate(b.get('researched_unknowns', []))]
for gap in gaps:
    raw = gap.get('scope', {})
    raw_ids = gap.get('option_ids', raw.get('option_ids', raw.get('study_option_ids', [raw['study_option_id']] if 'study_option_id' in raw else [])))
    gap['option_ids'] = [idmap.get(oid, oid) for oid in raw_ids]
for option in options:
    option['researched_unknown_ids'] = [g['id'] for g in gaps if option['id'] in g['option_ids']]
unfinished = [dict(evidence_file=name, task=t) for name,b in bundles.items() for t in b.get('uncompleted_collection', [])]
catalog = {'schema_version':'imperial-stage1-1.0','status':'draft_pending_review','institution':{'id':'imperial-college-london-uk','name':'Imperial College London','runtime_rank':2,'ranking':'QS World University Rankings2026'},
           'checked_at':'2026-10-01','sources_file':'sources.json','evidence_files':EVIDENCE,'historical_provenance_file':'runtime-provenance.json',
           'evidence_fingerprints': {name: hashlib.sha256(ROOT.joinpath(name).read_bytes()).hexdigest() for name in EVIDENCE},
           'inventory':{'official_search_rows':239,'undergraduate_search_rows':73,'postgraduate_taught_search_rows':166,'rule':'Search rows, award variants, departmental degrees and scheme applications are distinct entities. MEng/MSci undergraduate entry remains undergraduate.'},
           'study_options':options,'application_procedures':procedures,'facts':fact_index,'researched_unknowns':gaps,'uncompleted_collection':unfinished}
write('catalog.json', catalog)
print(len(options), 'linked options;',len(procedures),'procedures;',len(fact_index),'fact indexes;',len(sources),'source records;',len(unfinished),'unfinished tasks')
