"""Capture official course metadata and temporary readable pages for research."""
import concurrent.futures
import json
import re
from collect import ROOT, CACHE, fetch, text


def capture(row):
    slug = row['url'].rstrip('/').split('/')[-1]
    cache = CACHE / (slug + '.html')
    raw = cache.read_text(encoding='utf-8') if cache.exists() else fetch(row['url'])
    (CACHE / (slug + '.html')).write_text(raw, encoding='utf-8')
    main = raw[raw.find('<h1'):]
    main = main[:main.find('Related courses')] if 'Related courses' in main else main
    main = re.sub(r'<(script|style)\b.*?</\1>', '', main, flags=re.S)
    (CACHE / (slug + '.txt')).write_text(text(main), encoding='utf-8')
    meta = {}
    for match in re.finditer(r'<h3[^>]*>(.*?)</h3>.{0,1200}?<h4[^>]*>(.*?)</h4>', raw, re.S):
        label, value = text(match[1]), text(match[2])
        if label in ['Qualification', 'Duration', 'Start date', 'Study mode', 'Delivered by', 'Location', 'Minimum entry standard']:
            meta[label] = value
    links = list(dict.fromkeys(re.findall(r'href="([^"]+)"', main)))
    return {**row, 'metadata': meta, 'related_official_links': [u for u in links if u.startswith('/') and ('apply/' in u or 'fees' in u or 'scholarship' in u)]}


if __name__ == '__main__':
    rows = json.loads((ROOT / 'course-search-snapshot.json').read_text(encoding='utf-8'))['rows']
    output, errors = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(capture, row): row for row in rows}
        for future in concurrent.futures.as_completed(futures):
            try:
                output.append(future.result())
            except Exception as exc:
                errors.append({'url': futures[future]['url'], 'error': str(exc)})
    output.sort(key=lambda row: row['url'])
    (ROOT / 'course-metadata.json').write_text(json.dumps({'checked_at': '2026-10-01', 'rows': output, 'capture_errors': errors}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(len(output), 'course pages;', len(errors), 'capture errors')
