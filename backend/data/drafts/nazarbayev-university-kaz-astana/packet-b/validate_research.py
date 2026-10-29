"""Validate packet B's inactive research and declared cross-packet references."""

import json
from pathlib import Path
from urllib.parse import urlparse


def validate(path=Path(__file__).with_name('research.json')):
    data = json.loads(path.read_text(encoding='utf-8'))
    root = path.parent.parent
    assignment = json.loads((root / 'assignment.json').read_text(encoding='utf-8'))
    assigned = {row['inventory_card_id'] for row in assignment['inventory'] if row['packet_id'] == 'b'}
    collections = ('inventory_entries', 'study_options', 'application_routes', 'facts', 'sources', 'gaps', 'cross_packet_refs')
    indexes = {}
    all_ids = []
    for key in collections:
        rows = data[key]
        ids = [row['id'] for row in rows]
        assert len(ids) == len(set(ids)), f'Duplicate {key} IDs'
        assert all(value.startswith('nu-b-') for value in ids), f'Invalid packet prefix: {key}'
        indexes[key] = {row['id']: row for row in rows}
        all_ids.extend(ids)
    assert len(all_ids) == len(set(all_ids)), 'Duplicate IDs across record types'
    assert data['runtime_active'] is False and data['ordinary_collection_complete'] is True
    assert len(data['inventory_entries']) == len(data['study_options']) == len(data['application_routes']) == 31
    assert {row['inventory_card_id'] for row in data['inventory_entries']} == assigned
    external_options = {value for row in data['cross_packet_refs'] for value in row.get('study_option_ids', [])}
    options = set(indexes['study_options']) | external_options

    def refs(values, target, label):
        assert set(values or []).issubset(target), f'Unresolved {label}: {set(values or []) - set(target)}'

    for key in ('inventory_entries', 'study_options', 'application_routes', 'facts', 'gaps'):
        for row in data[key]:
            refs(row.get('source_ids', []), indexes['sources'], row['id'] + ' sources')
            refs(row.get('fact_ids', []), indexes['facts'], row['id'] + ' facts')
            refs(row.get('shared_policy_fact_ids', []), indexes['facts'], row['id'] + ' shared policy')
            refs(row.get('admission_route_ids', row.get('application_route_ids', [])), indexes['application_routes'], row['id'] + ' routes')
            refs(row.get('study_option_ids', []), options, row['id'] + ' options')
            refs(row.get('cross_packet_refs', []), indexes['cross_packet_refs'], row['id'] + ' cross packet')
            scope = row.get('scope', {})
            if isinstance(scope, dict):
                refs(scope.get('study_option_ids', []), options, row['id'] + ' scoped options')
                refs(scope.get('application_route_ids', []), indexes['application_routes'], row['id'] + ' scoped routes')
    for source in data['sources']:
        host = urlparse(source['url']).hostname or ''
        assert host == 'nu.edu.kz' or host.endswith('.nu.edu.kz') or host == 'soas.ac.uk' or host.endswith('.soas.ac.uk'), host
        assert source.get('access_checked_at') and source.get('content_reviewed_at'), source['id']
    for row in data['gaps']:
        assert row['review_status'].startswith('verified') and row.get('next_action'), row['id']
        assert row.get('source_ids') and row.get('checked_at'), row['id']
    for route in data['application_routes']:
        assert route['ordinary_collection_complete'] is True
        linked = set(route.get('fact_ids', []))
        for option_id in route['study_option_ids']:
            linked.update(indexes['study_options'][option_id].get('fact_ids', []))
        active = [indexes['facts'][value] for value in linked if indexes['facts'][value]['review_status'] != 'superseded']
        kinds = {row['kind'] for row in active}
        assert {'study_content', 'eligibility'}.issubset(kinds) and len(active) >= 3, route['id']
    facts = indexes['facts']
    assert facts['nu-b-finance-tuition']['value']['period'] == 'whole16-month/four-semester program'
    assert facts['nu-b-msn-fee-scope-reviewed']['value']['program_specific_tuition']['amount'] == 6000
    assert facts['nu-b-md-study']['value']['entry'] == 'graduate after bachelor/equivalent'
    assert facts['nu-b-joint-soas-dates-cost-support']['value']['deadline'] == '31July, year not stated on course page'
    assert len(data['shared_master_policy']['fact_ids']) == 4
    print('PASS: 31 assigned cards; unique IDs; local and declared cross-packet references; provenance dates; key fee/award/cycle cases.')
    print(', '.join(f'{key}={len(indexes[key])}' for key in collections))
    return data


if __name__ == '__main__':
    validate()
