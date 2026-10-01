"""Validate MIT draft structure and references with the standard library.

This is a focused draft check, not a JSON Schema implementation or research
completeness test. Run from the repository root with the backend interpreter.
"""
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
errors = []
parsed = {}
for path in sorted(ROOT.glob('*.json')):
    try:
        parsed[path.name] = json.loads(path.read_text(encoding='utf-8'))
    except (ValueError, UnicodeError) as error:
        errors.append(f'{path.name}: {error}')

schema = parsed['schema.json']
def shape(value, definition, context):
    """Check the exact shape keywords used by this draft's schema.

    This intentionally supports local $ref, type, const, enum, required,
    properties, additionalProperties, items and date/URI formats; not a reusable
    JSON Schema engine. Fail if a new assertion keyword needs support.
    """
    supported = {'$ref', 'type', 'const', 'enum', 'required', 'properties', 'additionalProperties', 'items', 'format', '$schema', '$id', '$defs', 'title', 'description'}
    for keyword in definition:
        if keyword not in supported:
            errors.append(f'{context}: unsupported schema keyword {keyword}')
    if '$ref' in definition:
        reference = definition['$ref']
        if not reference.startswith('#/$defs/'):
            errors.append(f'{context}: unsupported reference {reference}')
            return
        shape(value, schema['$defs'][reference.split('/')[-1]], context)
        return
    kinds = {'object': isinstance(value, dict), 'array': isinstance(value, list), 'string': isinstance(value, str), 'integer': isinstance(value, int) and not isinstance(value, bool), 'number': isinstance(value, (int, float)) and not isinstance(value, bool), 'boolean': isinstance(value, bool), 'null': value is None}
    expected = definition.get('type')
    if expected:
        accepted = expected if isinstance(expected, list) else [expected]
        if not any(kinds.get(kind, False) for kind in accepted):
            errors.append(f'{context}: expected {expected}, got {type(value).__name__}')
            return
    if 'const' in definition and value != definition['const']:
        errors.append(f'{context}: incorrect const value')
    if 'enum' in definition and value not in definition['enum']:
        errors.append(f'{context}: invalid enum value {value}')
    if definition.get('format') == 'date':
        try:
            date.fromisoformat(value)
        except (TypeError, ValueError):
            errors.append(f'{context}: invalid date')
    elif definition.get('format') == 'uri':
        parsed_uri = urlparse(value)
        if not parsed_uri.scheme or not parsed_uri.netloc:
            errors.append(f'{context}: invalid absolute URI')
    elif 'format' in definition:
        errors.append(f'{context}: unsupported format {definition["format"]}')
    if isinstance(value, dict):
        properties = definition.get('properties', {})
        for key in definition.get('required', []):
            if key not in value: errors.append(f'{context}: missing {key}')
        for key, item in value.items():
            if key in properties:
                shape(item, properties[key], f'{context}/{key}')
            elif definition.get('additionalProperties') is False:
                errors.append(f'{context}: unexpected property {key}')
    if isinstance(value, list) and 'items' in definition:
        for index, item in enumerate(value):
            shape(item, definition['items'], f'{context}/{index}')

for name in ['catalog.json', 'template.json']:
    data = parsed[name]
    shape(data, schema, name)
    if data.get('schema_version') != '2.0':
        errors.append(f'{name}: expected version 2.0')
    for key in schema['required']:
        if key not in data:
            errors.append(f'{name}: missing {key}')
    indexes = {}
    for section in ['sources', 'subjects', 'program_families', 'study_options', 'catalog_entries', 'application_routes', 'facts', 'exclusions']:
        records = data.get(section, [])
        counts = Counter(r['id'] for r in records)
        errors.extend(f'{name}/{section}: duplicate {id}' for id, count in counts.items() if count != 1)
        indexes[section] = {r['id']: r for r in records}
    def refs(record, key, section, context):
        for id in record.get(key, []):
            if id not in indexes[section]:
                errors.append(f'{name}/{context}: unresolved {key} {id}')
    for section in ['study_options', 'catalog_entries', 'application_routes', 'facts', 'program_families']:
        definition = {'study_options':'option', 'catalog_entries':'entry', 'application_routes':'route', 'facts':'fact', 'program_families':'family'}[section]
        for record in data[section]:
            context = record['id']
            for key in schema['$defs'][definition]['required']:
                if key not in record:
                    errors.append(f'{name}/{context}: missing {key}')
            for key, target in [('source_ids','sources'), ('study_option_ids','study_options'), ('route_ids','application_routes'), ('subject_ids','subjects'), ('fact_ids','facts'), ('related_fact_ids','facts'), ('catalog_entry_ids','catalog_entries')]:
                refs(record, key, target, context)
            if record.get('program_family_id') and record['program_family_id'] not in indexes['program_families']:
                errors.append(f'{name}/{context}: missing program family')
            if not record.get('source_ids'):
                errors.append(f'{name}/{context}: no source evidence')
            if section == 'study_options' or section == 'catalog_entries' and record.get('application'):
                app = record['application']
                refs(app, 'route_ids', 'application_routes', context)
                refs(app, 'source_ids', 'sources', context)
                if not app.get('reason'):
                    errors.append(f'{name}/{context}: no application classification reason')
                for key in ['publication_status', 'review_status', 'checked_at', 'period']:
                    if not app.get(key): errors.append(f'{name}/{context}: missing application {key}')
            if section == 'facts':
                for key, target in [('study_option_ids','study_options'), ('route_ids','application_routes')]:
                    refs(record['scope'], key, target, context)
                for key in ['institution_id', 'study_option_ids', 'route_ids', 'study_levels', 'applicant_category']:
                    if key not in record['scope']:
                        errors.append(f'{name}/{context}: missing scope {key}')
                if record['publication_status'] not in schema['$defs']['fact']['properties']['publication_status']['enum']:
                    errors.append(f'{name}/{context}: invalid publication status')
                if record['review_status'] not in schema['$defs']['fact']['properties']['review_status']['enum']:
                    errors.append(f'{name}/{context}: invalid review status')
                if not record.get('period', {}).get('label'):
                    errors.append(f'{name}/{context}: no period')
                try:
                    date.fromisoformat(record['checked_at'])
                except ValueError:
                    errors.append(f'{name}/{context}: invalid checked_at')
                if record['publication_status'] in ['unknown', 'not_published', 'conflicting'] and not record.get('resolution', {}).get('next_official_step'):
                    errors.append(f'{name}/{context}: unknown/conflict has no official next step')
                for condition in record['conditions']:
                    if not condition.get('when') or not condition.get('effect'):
                        errors.append(f'{name}/{context}: incomplete condition')
                    refs(condition, 'related_fact_ids', 'facts', context)
    for source in data['sources']:
        host = urlparse(source['url']).hostname or ''
        if not (host == 'mit.edu' or host.endswith('.mit.edu') or host == 'mitadmissions.org' or host.endswith('.mitadmissions.org')):
            errors.append(f'{name}/{source["id"]}: non-MIT source')
    for option in data['study_options']:
        for rid in option['application']['route_ids']:
            if option['id'] not in indexes['application_routes'][rid]['study_option_ids']:
                errors.append(f'{name}/{option["id"]}: route reverse link missing {rid}')
        for eid in option['catalog_entry_ids']:
            if option['id'] not in indexes['catalog_entries'][eid]['study_option_ids']:
                errors.append(f'{name}/{option["id"]}: catalog reverse link missing {eid}')
        if not option['subject_ids']:
            errors.append(f'{name}/{option["id"]}: missing discovery subjects')
        if option['application']['classification'] == 'evidenced_unresolved':
            if option['application']['publication_status'] != 'unknown' or 'Next official step:' not in option['application']['reason']:
                errors.append(f'{name}/{option["id"]}: unresolved classification lacks reason/official next step')
        if 'Bachelor' in option['study_levels']:
            if set(option['application']['route_ids']) != {'mit-first-year', 'mit-transfer'} or option['application']['classification'] != 'post_admission_major':
                errors.append(f'{name}/{option["id"]}: undergraduate major incorrectly has separate admission')
        if not any(indexes['facts'][id]['group'] in ['study_content', 'degree_completion'] for id in option['fact_ids']):
            errors.append(f'{name}/{option["id"]}: no bounded study description')
    for route in data['application_routes']:
        expected_facts = {f['id'] for f in data['facts'] if route['id'] in f['scope']['route_ids'] or set(route['study_option_ids']) & set(f['scope']['study_option_ids'])}
        if set(route['fact_ids']) != expected_facts:
            errors.append(f'{name}/{route["id"]}: incomplete route fact index')
    for fact in data['facts']:
        if fact['review_status'] == 'superseded' and not fact.get('superseded_reason'):
            errors.append(f'{name}/{fact["id"]}: superseded evidence lacks reason')
        if fact['review_status'] == 'needs_review':
            errors.append(f'{name}/{fact["id"]}: uncompleted fact review')
    if '\ufffd' in json.dumps(data, ensure_ascii=False):
        errors.append(f'{name}: Unicode replacement character')
    print(json.dumps({'file': name, 'options': len(data['study_options']), 'catalog_rows': len(data['catalog_entries']), 'routes': len(data['application_routes']), 'facts': len(data['facts']), 'review_statuses': dict(Counter(f['review_status'] for f in data['facts'])), 'completion_status': data['snapshot']['completion_status']}, sort_keys=True))

data = parsed['catalog.json']
source_index = {s['id']: s for s in data['sources']}
rows = parsed['catalog-degree-table-rows-2026-09-30.json']
raw_counts = Counter((r['source_url'], r['family'], r['award_label'], r['program_label']) for r in rows)
entry_counts = Counter((source_index[e['source_ids'][0]]['url'], e['official_family_label'], e['official_award_label'], e['official_field_label']) for e in data['catalog_entries'])
if raw_counts != entry_counts:
    errors.append('catalog.json: preserved official table rows do not reconcile exactly')
for entry in data['catalog_entries']:
    if not entry['study_option_ids'] and not entry.get('excluded_reason'):
        errors.append(f'{entry["id"]}: unmapped catalog row without an exclusion')

matrix = parsed.get('route-coverage.json')
if matrix:
    route_index = {r['id']: r for r in data['application_routes']}
    fact_index = {f['id']: f for f in data['facts']}
    if Counter(r['route_id'] for r in matrix['routes']) != Counter(route_index.keys()):
        errors.append('route-coverage.json: route set differs from catalog')
    for row in matrix['routes']:
        if set(row['groups']) != set(data['coverage']['fact_groups']):
            errors.append(f'{row["route_id"]}: incomplete fact-group coverage')
        if set(row['study_option_ids']) != set(route_index[row['route_id']]['study_option_ids']):
            errors.append(f'{row["route_id"]}: matrix option scope differs')
        for group, cell in row['groups'].items():
            ids = cell['route_fact_ids'] + cell['shared_reference_fact_ids']
            if any(id not in fact_index for id in ids):
                errors.append(f'{row["route_id"]}/{group}: unresolved coverage fact')
            if any(id not in source_index for id in cell['reviewed_source_ids']) or not cell['reviewed_source_ids']:
                errors.append(f'{row["route_id"]}/{group}: missing coverage source')
            if cell['status'] == 'bounded_omission' and not (cell.get('reason') and cell.get('next_official_step') and cell['publication_status'] == 'unknown'):
                errors.append(f'{row["route_id"]}/{group}: unjustified bounded omission')
            if cell['status'] not in ['reviewed_evidence', 'bounded_omission']:
                errors.append(f'{row["route_id"]}/{group}: unfinished research')
    expected = {o['id'] for o in data['study_options'] if o['application']['classification'] == 'evidenced_unresolved'}
    if {r['study_option_id'] for r in matrix['unresolved_awards']} != expected:
        errors.append('route-coverage.json: unresolved award set differs')
    if matrix['uncompleted_collection']:
        errors.append('route-coverage.json: uncompleted collection remains')
    print(f'Checked {len(matrix["routes"])} routes x {len(matrix["fact_groups"])} groups and {len(expected)} evidenced unresolved awards')
print(f'Reconciled {len(rows)} official catalog rows with mapped/excluded entries')

# Focused semantic acceptance for the three confirmed review failures.
fact_index = {f['id']: f for f in data['facts']}
route_index = {r['id']: r for r in data['application_routes']}
matrix_index = {r['route_id']: r for r in matrix['routes']}
for document in ['catalog.json', 'template.json']:
    facts = {f['id']: f for f in parsed[document]['facts']}
    description = facts.get('mit-course-6-9p-meng-description')
    if description and 'academic_tests' in description.get('topics', []):
        errors.append(f'{document}: BCS study description falsely classified as entrance-test evidence')
    unknown = facts.get('bcs-meng-academic-tests-unestablished')
    if not unknown or unknown['publication_status'] != 'unknown' or not unknown['value'].get('unestablished'):
        errors.append(f'{document}: BCS academic-test uncertainty missing')
for rid, fid in [('mit_bcs_meng_admissions', 'bcs-meng-academic-tests-unestablished'),
                 ('mit_mitili_sm_admissions', 'mitili-academic-tests-unestablished')]:
    cell = matrix_index[rid]['groups']['academic_tests']
    if cell['route_fact_ids'] != [fid] or cell['shared_reference_fact_ids'] or cell['publication_status'] != 'unknown' or cell['unresolved_fact_ids'] != [fid]:
        errors.append(f'{rid}: academic-test coverage must preserve its sole evidenced unknown')
shared = {
    'documents': 'linguistics-shared-application-documents',
    'application_windows': 'linguistics-shared-application-window-and-fee',
    'language_tests': 'linguistics-current-tests-and-oge-conflict',
}
boundary = fact_index['mitili-shared-linguistics-application-boundary']
for group, fid in shared.items():
    fact = fact_index[fid]
    if set(fact['scope']['route_ids']) != {'mit_mitili_sm_admissions', 'mit_linguistics_doctoral_admissions'} or set(fact['scope']['study_levels']) != {'Master', 'Doctorate'}:
        errors.append(f'{fid}: shared application applicability missing')
    if fid not in boundary['related_fact_ids'] or fid not in route_index['mit_mitili_sm_admissions']['fact_ids'] or fid not in matrix_index['mit_mitili_sm_admissions']['groups'][group]['route_fact_ids']:
        errors.append(f'{fid}: MITILI cannot reach concrete shared policy through explicit scoped links')
documents = fact_index[shared['documents']]['value']
if not all(documents.get(k) for k in ['required', 'samples', 'research_summary', 'transcripts']):
    errors.append('MITILI: incomplete shared document evidence')
deadline = fact_index[shared['application_windows']]['value']['deadline']
if deadline != {'month': 12, 'day': 15, 'year': None, 'time': None, 'timezone': None}:
    errors.append('MITILI: yearless deadline or unpublished time boundary lost')
english = fact_index[shared['language_tests']]
if english['publication_status'] != 'conflicting' or not all(english['value'].get(k) for k in ['department', 'oge', 'automatic_exemption', 'department_waiver', 'oge_scope_boundary']) or 'gre' in english['value']:
    errors.append('MITILI: English conflict/waiver evidence or doctoral GRE boundary lost')
for fid in ['linguistics-doctoral-gre-policy', 'linguistics-doctoral-entry-format-and-funding']:
    if fact_index[fid]['scope']['route_ids'] != ['mit_linguistics_doctoral_admissions'] or fact_index[fid]['scope']['study_levels'] != ['Doctorate']:
        errors.append(f'{fid}: doctoral-only policy leaked to MITILI')
gap_histories = [f for f in data['facts'] if f['id'].startswith('reviewed-') and f['id'].endswith('-gaps')]
if len(gap_histories) != 13:
    errors.append('Expected thirteen individually reconciled historical gap records')
for history in gap_histories:
    if history['review_status'] != 'superseded' or history['publication_status'] == 'published' or not history.get('related_fact_ids') or not history.get('superseded_reason'):
        errors.append(f'{history["id"]}: editorial gap remains a current published university fact')
    duplicate = fact_index[history['scope']['route_ids'][0] + '-extra-requirements']
    if duplicate['review_status'] != 'superseded' or not duplicate['related_fact_ids']:
        errors.append(f'{duplicate["id"]}: repeated editorial gap remains current')
    if not any(fact_index[fid]['review_status'] != 'superseded' for fid in history['related_fact_ids']):
        errors.append(f'{history["id"]}: no current policy/unknown resolves the historical note')
for row in matrix['routes']:
    for group, cell in row['groups'].items():
        ids = cell['route_fact_ids'] + cell['shared_reference_fact_ids']
        if any(fact_index[fid]['review_status'] == 'superseded' for fid in ids):
            errors.append(f'{row["route_id"]}/{group}: current coverage references superseded history')
        if ids and cell['publication_status'] == 'mixed_published_and_unresolved' and not any(fact_index[fid]['publication_status'] == 'published' for fid in ids):
            errors.append(f'{row["route_id"]}/{group}: mixed status lacks any published fact')
print('Checked focused BCS test evidence, explicit MITILI applicability and 13 historical gap resolutions')

for error in errors:
    print(error, file=sys.stderr)
print(f'Parsed {len(parsed)} JSON files; structural/reference errors: {len(errors)}')
sys.exit(bool(errors))
