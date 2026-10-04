"""Focused structural and contrast checks for the Imperial draft, using the standard library."""
import json
import hashlib
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
errors = []
def require(condition, message):
    if not condition: errors.append(message)
def read(name):
    return json.loads(ROOT.joinpath(name).read_text(encoding='utf-8-sig'))
catalog = read('catalog.json')
sources = read(catalog['sources_file'])['sources']
options = catalog['study_options']; contexts = catalog['application_procedures']; index = catalog['facts']
for kind, rows in [('source',sources),('option',options),('context',contexts),('fact',index)]:
    ids = [x['id'] for x in rows]
    require(len(ids)==len(set(ids)),kind+' IDs must be unique')
source_ids = {x['id'] for x in sources}; option_ids = {x['id'] for x in options}; context_ids = {x['id'] for x in contexts}
fact_ids = {x['id'] for x in index}
for s in sources:
    host = urlsplit(s['url']).hostname or ''
    university_host = host=='imperial.ac.uk' or host.endswith('.imperial.ac.uk')
    partner_host = host == 'cumbriamed.ac.uk' and s.get('institution_relationship') == 'Imperial and University of Cumbria joint medical school'
    joint_cdt_options = {
        'statml.io': 'imperial-math-statml',
        'www.randomsystems-cdt.ac.uk': 'imperial-math-random-systems',
        'ccmi-cdt.org': 'imperial-math-ccmi',
        'www.mfccdt.ac.uk': 'imperial-math-future-climate',
    }
    if host in joint_cdt_options:
        partner_host = s.get('accepted_option_ids') == [joint_cdt_options[host]] and s.get('relationship_evidence_source_ids') == ['source-7e7361227d1c5363'] and bool(s.get('institution_relationship'))
    if host == 'www.imagingcdt.com':
        partner_host = s.get('accepted_option_ids') == ['imperial-medical-imaging-integrated'] and s.get('relationship_evidence_source_ids') == ['source-1e206d093548d31a'] and s.get('institution_relationship') == 'Imperial and Kings College London joint Smart Medical Imaging CDT'
    require(university_host or partner_host, 'Non-university evidence URL: '+s['id'])
    require(bool(s.get('checked_at') or s.get('verified_at')), 'Missing original source review date: '+s['id'])
bundles = {n:read(n) for n in catalog['evidence_files']}
facts = {f['id']:f for b in bundles.values() for f in b['facts']}
require(fact_ids == set(facts), 'Canonical index must contain every current evidence fact exactly once')
for name, bundle in bundles.items():
    require(catalog.get('evidence_fingerprints', {}).get(name) == hashlib.sha256(ROOT.joinpath(name).read_text(encoding='utf-8').encode('utf-8')).hexdigest(), 'Stale assembled evidence: '+name)
    for source in bundle['sources']:
        retained = next((s for s in sources if s['id'] == source['id']), {})
        require(source in retained.get('evidence_records', []), 'Source provenance must match current evidence: '+source['id'])
    for record in bundle.get('inventory_reconciliation', []):
        for variant in record.get('variants', []):
            require(variant['variant_id'] in option_ids, 'Missing reviewed selector option: '+variant['variant_id'])
        for option in record.get('study_options', []):
            if option.get('parent_study_option_id') or option.get('inventory_origin'):
                require(option['id'] in option_ids, 'Missing reviewed school entry: '+option['id'])
for f in index:
    require(f['id'] in facts, 'Missing indexed fact: '+f['id'])
    require(f['source_ids'] and set(f['source_ids'])<=source_ids, 'Invalid fact sources: '+f['id'])
    require(set(f['scope']['option_ids'])<=option_ids, 'Invalid fact options: '+f['id'])
    require(set(f['scope']['route_ids'])<=context_ids, 'Invalid fact routes: '+f['id'])
    require(f.get('content_reviewed_at') is not None, 'Missing original fact content review: '+f['id'])
    original = facts[f['id']]
    raw = original.get('scope', {})
    raw_options = raw.get('option_ids', raw.get('study_option_ids', [raw['study_option_id']] if 'study_option_id' in raw else []))
    require(len(f['scope']['option_ids']) == len(raw_options), 'Lost original option scope: '+f['id'])
    require(f['scope'].get('original_scope') == raw, 'Original applicability dimensions must survive: '+f['id'])
    require(f['source_ids'] == original['source_ids'], 'Changed original fact provenance: '+f['id'])
    for sid in f['source_ids']:
        source = next(s for s in sources if s['id'] == sid)
        if source.get('accepted_option_ids'):
            require(bool(f['scope']['option_ids']) and set(f['scope']['option_ids']) <= set(source['accepted_option_ids']), 'Joint-centre source cannot establish policy outside its verified programme: '+f['id'])
    require(all(k in f['scope'] for k in ['study_levels','option_ids','route_ids','applicant_categories','cycle','fee_status']), 'Incomplete fact scope: '+f['id'])
for o in options:
    require(o['source_ids'] and set(o['source_ids'])<=source_ids, 'Invalid option sources: '+o['id'])
    require(set(o['procedure_ids'])<=context_ids, 'Invalid option context: '+o['id'])
    require(set(o['fact_ids'])<=fact_ids, 'Invalid option facts: '+o['id'])
    for fid in o['fact_ids']:
        linked = next(f for f in index if f['id'] == fid)
        require(o['id'] in linked['scope']['option_ids'], 'Fact link must preserve option ownership: '+o['id'])
for p in contexts:
    require(set(p['option_ids'])<=option_ids,'Invalid context options: '+p['id'])
    require(p['source_ids'] and set(p['source_ids'])<=source_ids,'Invalid context sources: '+p['id'])
    for oid in p['option_ids']:
        option = next(o for o in options if o['id']==oid)
        require(p['id'] in option['procedure_ids'], 'Procedure reverse relationship: '+p['id']+' / '+oid)
for o in options:
    for pid in o['procedure_ids']:
        require(o['id'] in next(p for p in contexts if p['id']==pid)['option_ids'], 'Option reverse relationship: '+o['id']+' / '+pid)
for gap in catalog['researched_unknowns']:
    require(bool(gap.get('reason') or gap.get('finding')), 'Unknown needs researched reason: '+gap['id'])
    require(bool(gap.get('official_next_step') or gap.get('next_step')), 'Unknown needs official next step: '+gap['id'])
    require(bool(gap.get('source_ids')) and set(gap['source_ids'])<=source_ids, 'Unknown needs valid reviewed sources: '+gap['id'])
    require(set(gap['option_ids'])<=option_ids, 'Unknown option scope: '+gap['id'])
panels = bundles['course-qualification-panels.json']
require(len(panels['coverage'])==239, 'Every reviewed search course needs qualification-selector coverage')
for f in panels['facts']:
    for group in f['value']['labelled_qualification_groups']:
        require(bool(group['qualification_group']), 'Qualification group must be named: '+f['id'])
        for row in group['qualification_requirements']:
            require(bool(row['qualification_label']) and bool(row['published_requirement']), 'Qualification rule must retain its selector label: '+f['id'])
snapshot = read('course-search-snapshot.json')
require(len(snapshot['rows'])==239,'Official search snapshot must reconcile 239 rows')
require(sum(r['type']=='Undergraduate' for r in snapshot['rows'])==73,'UG search snapshot count')
require(sum(r['type']=='Postgraduate taught' for r in snapshot['rows'])==166,'PGT search snapshot count')
require(all('?page=' not in str(v) for r in snapshot['rows'] for v in r.get('variants',[])),'Pagination cannot be a study variant')
history = read('runtime-provenance.json')['programs']
require(len(history)==25,'All 25 existing runtime entries must be reconciled')
for p in history:
    require(bool(p['draft_option_ids']) and set(p['draft_option_ids'])<=option_ids,'Unreconciled runtime entry: '+p['runtime_id'])
# Meaningful contrasts: the index must retain separate entry classifications and scoped exceptions.
byid = {o['id']:o for o in options}
require(byid['imperial-option-computing-meng']['level']=='undergraduate','Integrated Computing MEng must retain undergraduate entry')
internal_phd = byid['imperial-option-medicine-phd']
require(internal_phd['level']=='doctoral', 'Intercalated Medicine PhD retains doctoral research level')
internal_context = next(p for p in contexts if p['id'] in internal_phd['procedure_ids'])
require(internal_context['classification']=='internal_progression' and internal_context['independent_application_status']=='internal_only', 'Intercalated Medicine PhD cannot become a school-leaver course application')
require(internal_context['shared_form_family']=='Department internal progression', 'Intercalated Medicine PhD does not use UCAS or an invented external My Imperial application')
require('imperial-option-medicine-phd' not in facts['imperial-ucas-process']['scope']['option_ids'], 'Internal PhD cannot inherit undergraduate UCAS requirements')
require('imperial-option-medicine-phd' in facts['imperial-mbbs-intercalated-phd-entry']['scope']['option_ids'], 'Internal PhD must resolve its researched internal eligibility')
pgcert_structure = facts['recheck-curriculum-imperial-option-digital-chemistry-variant-1']['value']
require(pgcert_structure['selector_label']=='PGCert' and 'Research Project' not in pgcert_structure['structure']['year_or_stage_labels'], 'Digital Chemistry PGCert cannot inherit the MSc research-project selector')
require(facts['imperial-mdres-gmc-exception']['value'].startswith('MD(Res) normally requires a UK registrable medical qualification'), 'MD(Res) must retain researched degree-specific medical eligibility')
require(any(p['option_id']=='imperial-option-aeronautical-engineering-variant-1' and p['fee_status']=='Home' and p['entry_cycle']=='2026' for p in facts['imperial-aeronautical-engineering-course-profile']['value']['course_page_tuition_fees']['labelled_rates']), 'Integrated abroad Home fee must retain its actual2026 entry label')
require(byid['imperial-business-doctoral']['award']=='MRes then PhD','Business doctoral entry must retain its MRes stage')
require(byid['imperial-mdres-gmc-exception']['id'] if 'imperial-mdres-gmc-exception' in byid else 'imperial-mdres-gmc-exception' in facts,'MD(Res) GMC exception must remain evidenced')
require('imperial-healthbridge-entry-process' in facts and 'imperial-healthbridge-funding-progression' in facts,'HealthBRIDGE separate form and fee gap conditions')
require('imperial-qrt-application' in facts,'QRT cross-school supervision uses Computing admission')
require(byid['imperial-option-digital-chemistry-variant-1']['award']=='PG Cert', 'Digital Chemistry PGCert must remain a distinct award')
require(facts['imperial-digital-chemistry-course-profile']['value']['duration']=='1 year', 'Digital Chemistry MSc duration cannot inherit the PGCert panel')
require(facts['imperial-digital-chemistry-pgcert-course-profile']['value']['duration']=='6 months', 'Digital Chemistry PGCert duration must retain its own panel')
for record in bundles['engineering-sciences-evidence.json']['inventory_reconciliation']:
    if record.get('variants'):
        base = record['published_base_key_facts']
        require(byid[record['option_id']]['published_key_facts']==base, 'Base selector facts must be retained independently: '+record['option_id'])
        require(bool(base.get('Duration')), 'Reviewed base selector duration is required: '+record['option_id'])
        for variant in record['variants']:
            require(byid[variant['variant_id']]['published_key_facts']==variant['published_variant_key_facts'], 'Variant selector facts must retain their own panel: '+variant['variant_id'])
require(byid['imperial-option-business-mres']['procedure_ids']==['procedure-business-doctoral'], 'Business MRes must use the integrated doctoral procedure')
require('imperial-business-doctoral-entry' in byid['imperial-option-business-mres']['fact_ids'], 'Integrated MRes phase must retain doctoral entry conditions')
require('imperial_intercalated_bsc_external_uk_irish' not in facts['imperial-ucas-process']['scope']['option_ids'], 'External iBSc cannot inherit UCAS')
ug_choices = {o['id'] for o in options if o['level']=='undergraduate' and o.get('inventory_origin') in ['official_course_search','reviewed_course_selector']}
require(set(facts['imperial-ucas-process']['scope']['option_ids'])==ug_choices, 'Shared UCAS scope must cover all actual undergraduate course choices')
require('imperial_business_mres' not in facts['fact_imperial_business_masters_scholarships_2027']['scope']['study_option_ids'], 'MSc-only scholarships cannot inherit into integrated Business MRes')
require(any('fee' in (g.get('topic','')+g.get('id','')).lower() for g in catalog['researched_unknowns']),'Unpublished future fees must remain explicit unknowns')
example = read('example.json')
for course, amount in [('artificial_intelligence_applications_and_innovation', '£48,300'), ('applied_multiomics_in_biomedicine', '£49,650'), ('responsible_mining_and_metals_finance', '£51,350')]:
    panels = facts['fact_imperial_' + course + '_course_admission_dates_fees_awards']['value']['tuition_and_additional_course_fee_panels']
    require(any(p.get('fee_status_panel') == 'Overseas fee' and p.get('amount_gbp') == amount for p in panels), 'Published Overseas tuition must retain its own fee-status panel: ' + course)
    if course == 'artificial_intelligence_applications_and_innovation':
        require(any(p.get('fee_status_panel') == 'Home fee' and p.get('amount_gbp') == amount for p in panels), 'Equal Home and Overseas prices must retain both fee-status labels')
require(example['selected_option'] == byid[example['selected_option']['id']], 'Filled example option must match catalog')
require(example['fact_index'] == next(f for f in index if f['id']==example['fact_index']['id']), 'Filled example index must match catalog')
require(example['resolved_evidence'] == facts[example['fact_index']['id']], 'Filled example must resolve current evidence')
require(example['application_context'] == next(p for p in contexts if p['id']==example['application_context']['id']), 'Filled example must retain actual application context')
for path in ROOT.glob('*.json'):
    raw = path.read_bytes()
    require(not raw.startswith(b'\xef\xbb\xbf'), 'BOM: '+path.name)
    raw.decode('utf-8')
print(json.dumps({'options':len(options),'selection_contexts':len(contexts),'indexed_facts':len(index),'source_records':len(sources),'researched_unknowns':len(catalog['researched_unknowns']),'uncompleted_collection':catalog['uncompleted_collection'],'errors':errors},indent=2))
raise SystemExit(1 if errors else 0)
