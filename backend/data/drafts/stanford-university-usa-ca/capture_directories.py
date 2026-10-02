"""Snapshot Stanford's public graduate and coterminal directory tables."""
import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
BASE = 'https://applygrad.stanford.edu/portal/explore-programs?cmd='


def rows(raw):
    result = []
    for part in re.split(r'<div class="su-card program"', raw)[1:]:
        head, body = part.split('>', 1)
        body = re.sub(r'<script\b.*?</script>', '', body, flags=re.S)
        text = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', body))).strip()
        links = [{'label': html.unescape(re.sub('<[^>]*>', '', label)), 'url': html.unescape(url)}
                 for url, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)]
        result.append({'title': html.unescape(re.search(r'data-name="([^"]+)"', head)[1]),
                       'school': html.unescape(re.search(r'data-school="([^"]+)"', head)[1]).strip(';'),
                       'links': links, 'published_directory_text': text})
    assert result, 'No program rows; a loading shell is not an inventory'
    return result


if __name__ == '__main__':
    for kind, command, parent in [
        ('graduate', 'grad-program-list', 'https://gradadmissions.stanford.edu/explore-programs'),
        ('coterm', 'coterm-program-list', 'https://studentservices.stanford.edu/my-academics/earn-my-degree/degree-requirements/coterminal-degree-programs/explore-coterm-programs'),
    ]:
        url = BASE + command
        result = {'checked_at': date.today().isoformat(), 'source_url': url, 'parent_source_url': parent,
                  'scope': 'Application directory; programme, applicant route, mode and entry term remain distinct. Professional programmes require separate evidence.',
                  'rows': rows(urlopen(url, timeout=45).read().decode('utf-8'))}
        ROOT.joinpath(kind + '-directory-snapshot.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(kind, len(result['rows']), 'directory targets')
