"""Validate linked research and semantic contrasts; acceptance is a separate gate."""
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


def valid_prose_items(value):
    """Keep whole prose or explicit when/effect conditions; reject list(text)."""
    return (isinstance(value, list) and all(
        (isinstance(item, str) and item.strip()) or
        (isinstance(item, dict) and all(isinstance(item.get(k), str) and item[k].strip()
                                      for k in ['when', 'effect'])) for item in value)
        and not (len(value) > 5 and all(isinstance(item, str) and len(item) == 1 for item in value)))


def read(name):
    return json.loads(ROOT.joinpath(name).read_text(encoding='utf-8'))


def shape(value, definition, schema, path='catalog'):
    """Check only the keywords actually used by this draft, following MIT's check."""
    failures = []
    supported = {'$schema', 'title', 'description', '$defs', '$ref', 'type', 'required', 'properties', 'const', 'enum', 'format', 'items', 'additionalProperties'}
    for key in definition.keys() - supported:
        failures.append(path + ': unsupported schema keyword ' + key)
    if '$ref' in definition:
        return shape(value, schema['$defs'][definition['$ref'].split('/')[-1]], schema, path)
    kinds = {'object': dict, 'array': list, 'string': str}
    if 'type' in definition and not isinstance(value, kinds[definition['type']]):
        return [path + ': incorrect type']
    if 'const' in definition and value != definition['const']:
        failures.append(path + ': incorrect constant')
    if 'enum' in definition and value not in definition['enum']:
        failures.append(path + ': invalid enum value')
    if definition.get('format') == 'date':
        try:
            date.fromisoformat(value)
        except (TypeError, ValueError):
            failures.append(path + ': invalid date')
    if isinstance(value, dict):
        for key in definition.get('required', []):
            if key not in value:
                failures.append(path + ': missing ' + key)
        for key, item in value.items():
            child = definition.get('properties', {}).get(key, definition.get('additionalProperties'))
            if isinstance(child, dict):
                failures.extend(shape(item, child, schema, path + '/' + key))
            elif child is False:
                failures.append(path + ': unexpected property ' + key)
    if isinstance(value, list) and 'items' in definition:
        for index, item in enumerate(value):
            failures.extend(shape(item, definition['items'], schema, path + '/' + str(index)))
    return failures


def errors(catalog, sources, bundles):
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    options = {o['id']: o for o in catalog['study_options']}
    procedures = {p['id']: p for p in catalog['application_procedures']}
    source_by_id = {s['id']: s for s in sources['sources']}
    check(len(options) == len(catalog['study_options']), 'Duplicate option IDs')
    check(len(procedures) == len(catalog['application_procedures']), 'Duplicate procedure IDs')
    check(len(source_by_id) == len(sources['sources']), 'Duplicate source IDs')
    facts = {f['id']: f for f in catalog['facts']}
    check(len(facts) == len(catalog['facts']), 'Duplicate fact IDs')
    for name, bundle in bundles.items():
        indexed = {f['original_id'] for f in catalog['facts'] if f['evidence_file'] == name}
        check(indexed == {f['id'] for f in bundle['facts']}, name + ': fact indexing lost or added evidence')
    for source in source_by_id.values():
        host = urlsplit(source['url']).hostname or ''
        check(host == 'stanford.edu' or host.endswith('.stanford.edu'), source['id'] + ': source is not university-hosted')
        check(bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', source['checked_at'])), source['id'] + ': invalid checked date')
    for oid, option in options.items():
        check(bool(option['title']) and bool(option['award']), oid + ': missing display title/award')
        if option.get('parent_option_id'):
            check(option['parent_option_id'] in options, oid + ': missing parent')
        for pid in option['procedure_ids']:
            check(pid in procedures, oid + ': missing procedure ' + pid)
            if pid in procedures:
                check(oid in procedures[pid]['option_ids'], oid + ': missing reverse procedure relationship')
        for profile in option['evidence_profiles']:
            check(any(o['id'] == profile['id'] for o in bundles[profile['evidence_file']]['study_options']), oid + ': missing original profile')
    for pid, procedure in procedures.items():
        for oid in procedure['option_ids']:
            check(oid in options, pid + ': missing option ' + oid)
        for sid in procedure.get('source_ids', []):
            check(sid in source_by_id, pid + ': missing source ' + sid)
        for shared in procedure.get('shared_policy_context_ids', []):
            check(shared in procedures, pid + ': missing conditional shared policy context ' + shared)
    for fact in facts.values():
        label = fact['id']
        original = next(f for f in bundles[fact['evidence_file']]['facts'] if f['id'] == fact['original_id'])
        check('value' in original and original['value'] is not None, label + ': missing original value')
        for field in ['conditions', 'exceptions']:
            check(valid_prose_items(original.get(field, [])), label + ': invalid or fragmented ' + field)
        for field in ['checked_at', 'publication_status', 'review_status']:
            check(fact[field] == original[field], label + ': changed original ' + field)
        check(fact['original_scope'] == original['scope'], label + ': original scope changed')
        check(bool(fact['source_ids']), label + ': missing provenance')
        for sid in fact['source_ids']:
            check(sid in source_by_id, label + ': missing source ' + sid)
        for oid in fact['scope'].get('option_ids', []):
            check(oid in options, label + ': missing scoped option ' + oid)
            if oid in options and fact['scope'].get('levels'):
                check(options[oid]['level'] in fact['scope']['levels'], label + ': level scope excludes option ' + oid)
            if oid in options and fact['scope'].get('procedure_ids'):
                check(bool(set(options[oid]['procedure_ids']).intersection(fact['scope']['procedure_ids'])),
                      label + ': procedure scope excludes option ' + oid)
        for pid in fact['scope'].get('procedure_ids', []):
            check(pid in procedures, label + ': missing scoped procedure ' + pid)
        check(any(fact['scope'].get(k) for k in ['option_ids', 'procedure_ids', 'levels', 'policy_family']), label + ': unbounded scope')
    for unknown in catalog['unresolved']:
        check(bool(unknown.get('reason')), unknown['id'] + ': researched unknown lacks a reason')
        check(bool(unknown.get('official_next_step', unknown.get('next_official_step'))), unknown['id'] + ': researched unknown lacks an official next step')
        check(bool(unknown['source_ids']), unknown['id'] + ': researched unknown lacks reviewed source evidence')
        if unknown.get('review_status') != 'superseded_by_completed_research':
            check(any(unknown['scope'].get(key) for key in ['option_ids', 'procedure_ids', 'levels']), unknown['id'] + ': researched unknown lacks actual applicability scope')
        for sid in unknown['source_ids']:
            check(sid in source_by_id, unknown['id'] + ': unresolved missing source ' + sid)
        for oid in unknown['scope'].get('option_ids', []):
            check(oid in options, unknown['id'] + ': unresolved missing option ' + oid)
        for pid in unknown['scope'].get('procedure_ids', []):
            check(pid in procedures, unknown['id'] + ': unresolved missing procedure ' + pid)
    expected = {'stanford-option-' + r['code'].lower().replace(' ', '-') for r in read('inventory-snapshot.json')['rows'] if r['degreeDesignation']}
    check(expected <= options.keys(), 'Degree inventory rows missing from canonical index')
    legacy = options.get('stanford-option-engrbs17', {})
    check(legacy.get('new_applicant_availability') == 'not_open_under_published_matriculation_restriction', 'Architectural Design must retain pre-Fall-2023 restriction')
    check(not any(pid.endswith((':stanford-first-year', ':stanford-transfer')) for pid in legacy.get('procedure_ids', [])), 'Legacy Architectural Design must not receive new-applicant admission links')
    check('stanford-option-econ-ba' in options and 'stanford-option-econ-bs' in options, 'Economics BA and BS are distinct official awards')
    check(options.get('stanford-option-engrbs18', {}).get('parent_option_id') == 'stanford-option-engr-bs', 'Engineering Physics subplan lost parent award')
    check(options.get('stanford-option-cs-bs', {}).get('level') == 'undergraduate', 'CS BS cannot become graduate entry')
    check(options.get('stanford-option-cs-ms', {}).get('level') == 'masters', 'CS MS must remain separate from undergraduate entry')
    social = {f['id']: f for f in bundles['hs-social-science-evidence.json']['facts']}
    external = social['symsys-ms-deadline-requirements-funding-2027-28']
    coterm = social['symsys-ms-coterm-window-and-requirements-2026-27']
    check(external['scope']['procedure_ids'] == ['symsys-ms-external'], 'Symbolic external materials must not apply to coterm')
    check(coterm['scope']['procedure_ids'] == ['symsys-ms-coterm'], 'Symbolic coterm must retain its own procedure')
    check('three recommendations' in external['value'] and 'two recommendations' in coterm['value'], 'Symbolic published recommendation distinction lost')
    check('May 3, 2027' in coterm['value'], 'Symbolic autumn coterm deadline lost')
    professional = {f['id']: f for f in bundles['professional-evidence.json']['facts']}
    mspa = professional['med_mspa_eligibility_process']
    # The official timeline labels the application year; classes begin August 2027.
    check(mspa['scope']['cycle'] == '2026-27 application timeline; August 2027 entry', 'MSPA application cycle must not become the entry year')
    check(all(detail in mspa['value'] for detail in ['Jul 15, 2026 at 11:59 p.m. Eastern Time', 'Complete status in CASPA', 'no other proof or evidence is accepted']), 'MSPA deadline must retain its published time, timezone and completion condition')
    medicine = {f['id']: f for f in bundles['medicine-graduate-evidence.json']['facts']}
    immun = medicine['enroute-immun-ms']
    check(not any('corresponding PhD' in str(condition) for condition in immun['conditions']), 'Immunology cannot assert an unverified corresponding-PhD restriction')
    neurs = medicine['enroute-neurs-ms']
    check(set(neurs['scope']['applicant_categories']) == {'current Stanford doctoral students in another department', 'current Stanford professional students'}, 'Neurosciences MS must retain the actual combined-degree population')
    for fid in ['biosci-home-program-selection', 'biosci-documents', 'biosci-funding-2026-27']:
        if fid in medicine:
            check({'stanford-option-bio-phd', 'stanford-option-bioph-phd'} <= set(medicine[fid]['scope']['option_ids']), fid + ': Biology/Biophysics common Biosciences scope lost')
    directory = bundles['directory-evidence.json']
    for kind in ['graduate', 'coterm']:
        snapshot = read(kind + '-directory-snapshot.json')
        indexed = [f for f in directory['facts'] if f['id'].startswith('stanford-' + kind + '-')]
        check(len(indexed) == len(snapshot['rows']), kind + ': directory row indexing incomplete')
        for row in snapshot['rows']:
            matches = [f for f in indexed if f['value']['programme'] == row['title']]
            check(len(matches) == 1, kind + ': missing or duplicate directory programme ' + row['title'])
            if len(matches) == 1:
                check(matches[0]['value']['published_table'] == row['published_directory_text'], kind + ': published terms/testing table changed ' + row['title'])
                check(matches[0]['checked_at'] == snapshot['checked_at'], kind + ': directory review date upgraded')
    example = read('example.json')
    check(len(example['examples']) == 4, 'Filled contrast examples missing')
    for case in example['examples']:
        check(bool(case['study_options']) and bool(case['facts']), case['case'] + ': empty contrast')
        for fact in case['facts']:
            original = next(f for f in bundles[fact['evidence_file']]['facts'] if f['id'] == fact['original_id'])
            check(fact['value'] == original['value'], fact['id'] + ': example value differs from evidence')
    return failures


def main():
    catalog = read('catalog.json')
    bundles = {name: read(name) for name in catalog['evidence_fingerprints']}
    schema = read('schema.json')
    failures = shape(catalog, schema, schema) + errors(catalog, read('sources.json'), bundles)
    for name, digest in catalog['evidence_fingerprints'].items():
        if hashlib.sha256(ROOT.joinpath(name).read_text(encoding='utf-8').encode('utf-8')).hexdigest() != digest:
            failures.append(name + ': canonical index is older than its source dossier; assemble again')
    if '--acceptance' in sys.argv:
        checkpoint = ROOT / 'recheck-owner.json'
        if checkpoint.exists() and read(checkpoint.name).get('review_status') != 'reviewed':
            failures.append('Comprehensive source recheck is not accepted; structural checks cannot close unfinished content review')
        open_tasks = [t for t in catalog['collection_tasks'] if t.get('status') not in ['completed', 'complete', 'closed', 'superseded_by_reviewed_evidence']]
        if open_tasks:
            failures.append(str(len(open_tasks)) + ' unresolved collection tasks; researched unknowns do not close unsearched groups')
        missing = [o['id'] for o in catalog['study_options'] if not o['evidence_profiles']]
        if missing:
            failures.append('Missing researched option profiles: ' + ', '.join(missing))
    for failure in failures:
        print('ERROR:', failure)
    print(len(catalog['study_options']), 'options;', len(catalog['facts']), 'facts;', len(failures), 'validation errors;',
          'acceptance checked' if '--acceptance' in sys.argv else 'structure only, collection acceptance pending')
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
