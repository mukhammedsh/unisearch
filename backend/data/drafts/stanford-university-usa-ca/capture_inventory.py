"""Capture the public program data displayed by Stanford's official Bulletin."""
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
URL = 'https://bulletin.stanford.edu/programs'


def capture():
    raw = urlopen(URL, timeout=45).read().decode('utf-8')
    payload = json.loads(re.search(r'<script[^>]+id="__NUXT_DATA__"[^>]*>(.*?)</script>', raw, re.S)[1])

    def decode(index):
        if index < 0:
            return None
        value = payload[index]
        if isinstance(value, dict):
            return {key: decode(ref) for key, ref in value.items()}
        if isinstance(value, list):
            return [decode(ref) for ref in value]
        return value

    settings = next(value for value in payload if isinstance(value, dict) and 'activeCatalog' in value and 'school' in value)
    config = {key: decode(ref) for key, ref in settings.items()}
    period = config['effectiveDatesRange']
    query = urlencode({'catalogId': config['activeCatalog'], 'limit': 1000, 'skip': 0,
                       'sortBy': 'name', 'effectiveDatesRange': period['effectiveStartDate'] + ',' + (period['effectiveEndDate'] or period['effectiveStartDate'])})
    endpoint = 'https://app.coursedog.com/api/v1/cm/' + config['school'] + '/programs/search/%24filters?' + query
    request = Request(endpoint, data=json.dumps(config['programsFilters']).encode(),
                      headers={'Content-Type': 'application/json', 'X-Requested-With': 'catalog', 'Origin': 'https://bulletin.stanford.edu'})
    result = json.loads(urlopen(request, timeout=45).read())
    assert len(result['data']) == result['listLength'], 'Inventory pagination requires continuation; do not accept a truncated snapshot'
    fields = ['code', 'name', 'programGroupId', 'type', 'level', 'degreeDesignation', 'departments',
              'college', 'catalogDescription', 'catalogFullDescription', 'customFields', 'requisites',
              'transcriptDescription', 'longName', 'catalogDisplayName', 'diplomaDescription', 'campus',
              'academicFocus', 'programLengthType', 'programLengthValue', 'fieldOfStudy', 'status',
              'effectiveStartDate', 'degreeMaps', 'degreeRequirements']
    snapshot = {'checked_at': date.today().isoformat(), 'source_url': URL,
                'catalog_period': config['catalogDisplayName'], 'catalog_id': config['activeCatalog'],
                'acquisition': 'Public endpoint configured by the official Bulletin; display filters and effective period preserved. Inventory metadata is not applicant-policy review.',
                'display_filters': config['programsFilters'], 'effective_dates_range': period,
                'total_rows': result['listLength'], 'rows': [{key: row.get(key) for key in fields} for row in result['data']],
                'completion_status': 'inventory_acquired_reconciliation_pending'}
    ROOT.joinpath('inventory-snapshot.json').write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"Captured {snapshot['total_rows']} inventory rows; admission classifications still require review")


if __name__ == '__main__':
    capture()
