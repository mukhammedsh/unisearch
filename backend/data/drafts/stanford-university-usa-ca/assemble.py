"""Assemble linked Stanford research without changing source dossiers or runtime."""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVIDENCE = ['undergraduate-study-evidence.json', 'undergraduate-shared-evidence.json',
            'directory-evidence.json', 'coterm-central-evidence.json',
            'engineering-doerr-evidence.json', 'humanities-education-medicine-evidence.json',
            'hs-social-science-evidence.json', 'medicine-graduate-evidence.json', 'professional-evidence.json',
            'supplementary-degree-evidence.json', 'doerr-completion-evidence.json']


def read(name):
    return json.loads(ROOT.joinpath(name).read_text(encoding='utf-8'))


def write(name, value):
    ROOT.joinpath(name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def main():
    inventory = read('inventory-snapshot.json')
    bundles = {name: read(name) for name in EVIDENCE if ROOT.joinpath(name).exists()}
    options = {}
    aliases = {}
    for row in inventory['rows']:
        if not row['degreeDesignation']:
            continue
        code = row['code']
        oid = 'stanford-option-' + code.lower().replace(' ', '-')
        award = row['degreeDesignation'].split(' - ', 1)[0]
        level = 'undergraduate' if row['level'] == 'Undergraduate Matriculated' else 'doctoral' if award in ['PHD', 'DMA'] else 'professional' if award in ['MBA', 'JD', 'JSD', 'JSM', 'LLM', 'MLS', 'MD'] else 'masters'
        options[oid] = {'id': oid, 'title': row['transcriptDescription'] or row['longName'],
                        'award': award, 'level': level, 'catalog_code': code,
                        'course_url': 'https://bulletin.stanford.edu/programs/' + row['programGroupId'],
                        'inventory_origin': 'official_bulletin_2026_27', 'checked_at': inventory['checked_at'],
                        'procedure_ids': [], 'evidence_profiles': [], 'application_classifications': []}
        aliases[code] = oid
        aliases[oid] = oid
        aliases['stanford-option-' + code.lower()] = oid
        aliases['stanford-' + code.lower().replace(' ', '-')] = oid
    for bundle in bundles.values():
        for option in bundle.get('study_options', []):
            programme_url = option.get('source_program_url', '')
            if '/programs/' in programme_url and not option.get('parent_option_id'):
                code = programme_url.split('/programs/', 1)[1].split('/')[0]
                if code in aliases:
                    aliases[option['id']] = aliases[code]
    for name, bundle in bundles.items():
        for option in bundle.get('study_options', []):
            catalog_oid = aliases.get(option.get('catalog_code'))
            variant = option.get('parent_option_id') and option['id'] != catalog_oid
            oid = aliases.get(option['id']) if variant else catalog_oid or aliases.get(option['id'])
            if not oid:
                oid = option['id'] if option['id'].startswith('stanford-option-') else 'stanford-option-' + re.sub(r'[^a-z0-9]+', '-', option['id'].lower()).strip('-')
                level = option['level']
                if level == 'graduate':
                    level = 'doctoral' if option['award'].upper() in ['PHD', 'DMA'] else 'masters'
                options.setdefault(oid, {'id': oid, 'title': option['title'], 'award': option['award'],
                                        'level': level, 'inventory_origin': 'additional_official_programme_evidence',
                                        'checked_at': option['checked_at'], 'procedure_ids': [], 'evidence_profiles': [], 'application_classifications': []})
            aliases[option['id']] = oid
            aliases[oid] = oid
            options[oid]['evidence_profiles'].append({'evidence_file': name, 'id': option['id']})
            options[oid]['application_classifications'].append({'classification': option['application_classification'],
                                                               'evidence_file': name, 'id': option['id']})
            if option.get('parent_option_id'):
                options[oid]['parent_option_id'] = option['parent_option_id']
            if option.get('new_applicant_availability'):
                options[oid]['new_applicant_availability'] = option['new_applicant_availability']
    sources = []
    facts = []
    procedures = []
    unresolved = []
    tasks = []
    procedure_aliases = {}
    procedure_candidates = {}
    for name, bundle in bundles.items():
        for procedure in bundle.get('application_procedures', []):
            pid = name.removesuffix('.json') + ':' + procedure['id']
            procedure_aliases[(name, procedure['id'])] = pid
            procedure_candidates.setdefault(procedure['id'], []).append(pid)

    def procedure_id(name, pid):
        local = procedure_aliases.get((name, pid))
        if local:
            return local
        candidates = procedure_candidates.get(pid, [])
        return candidates[0] if len(candidates) == 1 else pid

    for name, bundle in bundles.items():
        prefix = name.removesuffix('.json') + ':'
        source_map = {source['id']: prefix + source['id'] for source in bundle['sources']}
        for source in bundle['sources']:
            sources.append({**source, 'id': source_map[source['id']], 'original_id': source['id'], 'evidence_file': name})
        for procedure in bundle.get('application_procedures', []):
            p = {**procedure, 'id': procedure_id(name, procedure['id']), 'evidence_file': name, 'original_id': procedure['id']}
            p['option_ids'] = [aliases.get(oid, oid) for oid in procedure.get('option_ids', [])]
            p['source_ids'] = [source_map[sid] for sid in procedure.get('source_ids', [])]
            if p.get('shared_policy_context_ids'):
                p['shared_policy_context_ids'] = [procedure_id(name, shared) for shared in p['shared_policy_context_ids']]
            if name == 'directory-evidence.json' and procedure['classification'] == 'external_nonprofessional_programme':
                p['shared_policy_context_ids'] = [procedure_id('undergraduate-shared-evidence.json', 'stanford-nonprofessional-graduate')]
                p['shared_policy_boundary'] = 'The official directory explicitly directs these named programmes to central How to Apply. Apply each central fact only within its own scope and programme exceptions; directory membership is not a universal fee, test or funding policy.'
            procedures.append(p)
            for oid in p['option_ids']:
                if oid in options and p['id'] not in options[oid]['procedure_ids']:
                    options[oid]['procedure_ids'].append(p['id'])
        for fact in bundle.get('facts', []):
            original = fact['scope']
            scope = {**original, 'option_ids': [aliases.get(oid, oid) for oid in original.get('option_ids', [])],
                     'procedure_ids': [procedure_id(name, pid) for pid in original.get('procedure_ids', [])]}
            level_aliases = {'master': 'masters', "master's": 'masters', 'bachelor': 'undergraduate', 'doctorate': 'doctoral'}
            scope['levels'] = [level_aliases.get(level, level) for level in original.get('levels', [])]
            if scope.get('option_ids') and any(level in ['graduate', 'professional graduate', 'intermediate graduate'] for level in scope.get('levels', [])):
                scope['levels'] = sorted({options[oid]['level'] for oid in scope['option_ids'] if oid in options})
            facts.append({'id': prefix + fact['id'], 'original_id': fact['id'], 'evidence_file': name,
                          'topic': fact['topic'], 'scope': scope, 'original_scope': original,
                          'source_ids': [source_map[sid] for sid in fact['source_ids']],
                          'checked_at': fact['checked_at'], 'publication_status': fact['publication_status'],
                          'review_status': fact['review_status']})
        for item in bundle.get('unresolved', []):
            original_scope = item.get('scope', {key: item[key] for key in ['option_ids', 'procedure_ids', 'levels', 'applicant_categories', 'cycle', 'fee_status'] if key in item})
            scope = {**original_scope,
                     'option_ids': [aliases.get(oid, oid) for oid in original_scope.get('option_ids', [])],
                     'procedure_ids': [procedure_id(name, pid) for pid in original_scope.get('procedure_ids', [])],
                     'levels': [level_aliases.get(level, level) for level in original_scope.get('levels', [])]}
            if scope['option_ids'] and 'graduate' in scope['levels']:
                scope['levels'] = sorted({options[oid]['level'] for oid in scope['option_ids'] if oid in options})
            unresolved.append({**item, 'evidence_file': name, 'original_id': item['id'], 'id': prefix + item['id'],
                               'source_ids': [source_map[sid] for sid in item.get('source_ids', item.get('evidence_source_ids', item.get('reviewed_source_ids', [])))],
                               'scope': scope, 'original_scope': original_scope,
                               'official_next_step': item.get('official_next_step', item.get('next_official_step', item.get('next_step')))})
        for item in bundle.get('collection_tasks', []):
            tasks.append({**item, 'evidence_file': name})
    for oid, option in options.items():
        for profile in option['evidence_profiles']:
            original = next(o for o in bundles[profile['evidence_file']]['study_options'] if o['id'] == profile['id'])
            for pid in original.get('procedure_ids', []):
                canonical_pid = procedure_id(profile['evidence_file'], pid)
                if canonical_pid not in option['procedure_ids']:
                    option['procedure_ids'].append(canonical_pid)
        if option.get('new_applicant_availability') == 'not_open_under_published_matriculation_restriction':
            option['procedure_ids'] = [pid for pid in option['procedure_ids'] if not pid.endswith((':stanford-first-year', ':stanford-transfer'))]
        if not option['evidence_profiles']:
            tasks.append({'id': 'missing-profile-' + oid, 'option_id': oid, 'status': 'collection_pending',
                          'topic': 'inventory_application_classification', 'next_step': option.get('course_url')})
    procedure_by_id = {p['id']: p for p in procedures}
    for oid, option in options.items():
        if option.get('parent_option_id'):
            option['parent_option_id'] = aliases.get(option['parent_option_id'], option['parent_option_id'])
        for pid in option['procedure_ids']:
            if pid in procedure_by_id and oid not in procedure_by_id[pid]['option_ids']:
                procedure_by_id[pid]['option_ids'].append(oid)
        option['reconciled_application_relationship'] = {
            'procedure_context_ids': option['procedure_ids'],
            'reason': 'All sourced external, coterm, internal, intermediate and combined contexts remain separate; a classification label is not an additional degree or a policy override.'}
        if oid == 'stanford-option-oceans-ms':
            option['reconciled_application_relationship']['reason'] = 'The current Doerr review establishes Oceans MS for current Oceans PhD students only; the earlier unresolved inventory note is superseded. No independent external or coterm MS admission is established.'
        elif oid in ['stanford-option-anthr-ma', 'stanford-option-econ-ma']:
            option['reconciled_application_relationship']['reason'] = 'An MA award may be reached through the separately sourced current-student coterm or doctoral/intermediate context; undergraduate study interest and terminal external admission are not inferred from the award name.'
    write('sources.json', {'sources': sources})
    coverage = []
    for oid, option in options.items():
        reviewed = []
        for profile in option['evidence_profiles']:
            for assessment in bundles[profile['evidence_file']].get('coverage_assessments', []):
                if assessment.get('option_id') in [profile['id'], oid]:
                    reviewed.append({'evidence_file': profile['evidence_file'], 'assessment': assessment})
        scoped_facts = [f['id'] for f in facts if oid in f['scope'].get('option_ids', [])]
        procedure_facts = [f['id'] for f in facts if not f['scope'].get('option_ids')
                           and set(option['procedure_ids']).intersection(f['scope'].get('procedure_ids', []))]
        shared_contexts = {shared for pid in option['procedure_ids'] if pid in procedure_by_id
                           for shared in procedure_by_id[pid].get('shared_policy_context_ids', [])}
        conditional_facts = [f['id'] for f in facts if shared_contexts.intersection(f['scope'].get('procedure_ids', []))
                             and (not f['scope'].get('option_ids') or oid in f['scope']['option_ids'])
                             and (not f['scope'].get('levels') or option['level'] in f['scope']['levels'])]
        coverage.append({'option_id': oid, 'evidence_profiles': option['evidence_profiles'],
                         'direct_option_fact_ids': scoped_facts, 'actual_procedure_fact_ids': procedure_facts,
                         'conditional_shared_fact_ids': conditional_facts, 'declared_domain_reviews': reviewed,
                         'boundary': 'Reference presence is not factual completeness. Use declared source-reviewed domains and the evidence dossiers; all scopes and conditions still intersect.'})
    write('coverage-index.json', {'status': 'linked_review_index_not_automatic_completeness', 'options': coverage})
    if '--reviewed' in sys.argv:
        unfinished = [t for t in tasks if t.get('status') not in ['completed', 'complete', 'closed', 'superseded_by_reviewed_evidence']]
        assert not unfinished, 'Cannot mark reviewed while collection tasks remain open'
        assert all(o['evidence_profiles'] for o in options.values()), 'Cannot mark reviewed with missing option evidence'
    write('catalog.json', {'schema_version': '1.0', 'institution': {'id': 'stanford-university-usa-ca', 'official_name': 'Stanford University'},
                           'snapshot': {'checked_at': inventory['checked_at'], 'catalog_period': '2026-27',
                                        'completion_status': 'reviewed' if '--reviewed' in sys.argv else 'in_progress'},
                           'inventory_file': 'inventory-snapshot.json', 'source_file': 'sources.json',
                           'evidence_fingerprints': {name: hashlib.sha256(ROOT.joinpath(name).read_text(encoding='utf-8').encode('utf-8')).hexdigest() for name in bundles},
                           'option_aliases': aliases, 'study_options': list(options.values()), 'application_procedures': procedures,
                           'facts': facts, 'unresolved': unresolved, 'collection_tasks': tasks})
    examples = []
    for label, selected in [
        ('Computer Science undergraduate interest, external MS and current-student coterm', ['stanford-option-cs-bs', 'stanford-option-cs-ms']),
        ('Degree choices and restricted legacy Engineering subplan', ['stanford-option-econ-ba', 'stanford-option-econ-bs', 'stanford-option-bas', 'stanford-option-engrbs17']),
        ('MSx separate award and Law named LLM specializations', ['stanford-option-gsb-msx', 'stanford-option-law-llm',
          'stanford-option-law-llm-corporate-governance-practice', 'stanford-option-law-llm-environmental-law-policy',
          'stanford-option-law-llm-international-economic-law-business-policy', 'stanford-option-law-llm-law-science-technology']),
        ('Different external and coterm Symbolic Systems materials and deadlines', ['stanford-option-symbo-ms']),
    ]:
        selected_options = [options[oid] for oid in selected if oid in options]
        selected_ids = {o['id'] for o in selected_options}
        selected_procedures = [p for p in procedures if selected_ids.intersection(p['option_ids'])]
        selected_pids = {p['id'] for p in selected_procedures}
        shared_contexts = {shared for p in selected_procedures for shared in p.get('shared_policy_context_ids', [])}
        conditional_ids = [f['id'] for f in facts if shared_contexts.intersection(f['scope'].get('procedure_ids', []))
                           and (not f['scope'].get('option_ids') or selected_ids.intersection(f['scope']['option_ids']))
                           and (not f['scope'].get('levels') or {o['level'] for o in selected_options}.intersection(f['scope']['levels']))]
        selected_facts = [f for f in facts if selected_ids.intersection(f['scope'].get('option_ids', []))
                          or selected_pids.intersection(f['scope'].get('procedure_ids', []))]
        examples.append({'case': label, 'study_options': selected_options, 'procedures': selected_procedures,
                         'conditional_shared_fact_ids': conditional_ids,
                         'facts': [{**f, 'value': next(original['value'] for original in bundles[f['evidence_file']]['facts']
                                                      if original['id'] == f['original_id'])} for f in selected_facts],
                         'applicability_boundary': 'Intersect programme, actual procedure, applicant category and labelled entry term. The presence of several procedures never applies every fact to every route.'})
    write('example.json', {'schema_version': '1.0', 'checked_at': inventory['checked_at'], 'status': 'filled_research_examples_not_runtime', 'examples': examples})
    print(len(options), 'options;', len(facts), 'indexed facts;', len(tasks),
          'closed collection task records (reviewed)' if '--reviewed' in sys.argv else 'collection task records (acceptance pending)')


if __name__ == '__main__':
    main()
