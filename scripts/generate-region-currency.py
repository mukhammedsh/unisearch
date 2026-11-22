"""Generate frontend/javascript/data/region-currency.js.

Usage: download into one folder Unicode CLDR `cldr-json/cldr-core/supplemental/currencyData.json` and the IANA tz
database `zone.tab` and `backward`, then run: python -I scripts/generate-region-currency.py <folder> frontend/javascript/data/region-currency.js
"""
import json, sys, pathlib
d = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
cldr = json.loads((d / "currencyData.json").read_text(encoding="utf-8"))
regions = cldr["supplemental"]["currencyData"]["region"]
countries = {}
for cc, entries in regions.items():
    if len(cc) != 2 or not cc.isalpha():
        continue
    current = []
    for entry in entries:
        for code, info in entry.items():
            if "_to" in info or info.get("_tender") == "false":
                continue
            current.append((info.get("_from", ""), code))
    if current:
        countries[cc] = sorted(current)[-1][1]
zones = {}
for line in (d / "zone.tab").read_text(encoding="utf-8").splitlines():
    if line.startswith("#") or not line.strip():
        continue
    cc, _coords, tz = line.split("\t")[:3]
    zones[tz] = cc
for line in (d / "backward").read_text(encoding="utf-8").splitlines():
    parts = line.split()
    if len(parts) >= 3 and parts[0] == "Link" and parts[1] in zones and parts[2] not in zones:
        zones[parts[2]] = zones[parts[1]]
version = cldr["supplemental"]["version"]["_cldrVersion"]
body = ("// Generated from Unicode CLDR " + version + " supplemental currencyData (each region's current tender currency) and the\n"
        "// IANA tz database zone.tab and backward links (each time zone's country). Regenerate from those sources; do not edit by hand.\n"
        "export const COUNTRY_CURRENCY = " + json.dumps(dict(sorted(countries.items())), separators=(",", ":")) + ";\n"
        "export const TIME_ZONE_COUNTRY = " + json.dumps(dict(sorted(zones.items())), separators=(",", ":")) + ";\n")
out.write_text(body, encoding="utf-8", newline="\n")
print(len(countries), len(zones), countries.get("KZ"), countries.get("SA"), countries.get("AE"), zones.get("Asia/Almaty"), zones.get("Asia/Calcutta"), zones.get("Asia/Riyadh"))
