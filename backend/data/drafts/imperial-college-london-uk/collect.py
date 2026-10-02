"""Capture Imperial's official course-search inventory; no runtime writes."""
import concurrent.futures
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT.parents[3] / '.tmp_test' / 'imperial'
BASE = 'https://www.imperial.ac.uk'


def text(value):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', value)).split())


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode('utf-8')


def page(number):
    url = BASE + '/study/courses/?page=' + str(number)
    raw = fetch(url)
    (CACHE / f'search-{number}.html').write_text(raw, encoding='utf-8')
    rows = []
    for block in raw.split('<div class="course-card js-course-card')[1:]:
        title = re.search(r'<h4 class="course-card__title"><a\s+href="([^"]+)">(.*?)</a>', block, re.S)
        if not title:
            continue
        def field(css):
            match = re.search(r'class="' + css + r'">(.*?)</', block, re.S)
            return text(match[1]) if match else None
        variants = re.findall(r'<li[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        rows.append({'name': text(title[2]), 'url': BASE + title[1], 'type': field('course-tags-list__type'), 'award': field('course-tags-list__qualification'), 'summary': field('course-card__desc'), 'search_page': url, 'variants': [{'url': BASE + u if u.startswith('/') else u, 'name': text(t)} for u, t in variants if '/study/courses/' in u and '?page=' not in u]})
    return number, rows, int(re.search(r'Showing\s+(\d+) results', raw)[1])


if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    first, rows, count = page(1)
    pages = (count + len(rows) - 1) // len(rows)
    all_rows = rows
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for number, result, reported in sorted(pool.map(page, range(2, pages + 1))):
            assert reported == count, (number, reported, count)
            all_rows.extend(result)
    assert len(all_rows) == count, (len(all_rows), count)
    output = {'checked_at': '2026-10-01', 'source_url': BASE + '/study/courses/', 'source_title': 'Course search | Study | Imperial College London', 'reported_results': count, 'rows': all_rows}
    (ROOT / 'course-search-snapshot.json').write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(count, 'official search rows captured;', pages, 'pages')
