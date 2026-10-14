"""Snapshot Stanford's public graduate and coterminal directory tables."""
import html
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
BASE = 'https://applygrad.stanford.edu/portal/explore-programs?cmd='


class _ScriptContentFilter(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.parts = []
        self.script_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.script_depth += 1
        elif not self.script_depth:
            self.parts.append(self.get_starttag_text())

    def handle_startendtag(self, tag, attrs):
        if not self.script_depth and tag != 'script':
            self.parts.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if tag == 'script':
            self.script_depth = max(0, self.script_depth - 1)
        elif not self.script_depth:
            self.parts.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.script_depth:
            self.parts.append(data)

    def handle_entityref(self, name):
        if not self.script_depth:
            self.parts.append(f'&{name};')

    def handle_charref(self, name):
        if not self.script_depth:
            self.parts.append(f'&#{name};')


def _without_scripts(markup):
    parser = _ScriptContentFilter()
    parser.feed(markup)
    parser.close()
    return ''.join(parser.parts)


def rows(raw):
    result = []
    for part in re.split(r'<div class="su-card program"', raw)[1:]:
        head, body = part.split('>', 1)
        body = _without_scripts(body)
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
