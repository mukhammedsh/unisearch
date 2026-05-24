import json
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "backend" / "data"

def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"File not found: {path}")
        return None
    return json.loads(path.read_text(encoding="utf-8"))

def audit():
    unis = load_json("universities.json")
    facts = load_json("official_facts.json")
    admissions = load_json("official_admissions.json")
    translations = load_json("universities_translations.json")
    
    if not unis:
        return
        
    print(f"Total universities in universities.json: {len(unis)}")
    
    # 1. Проверка дубликатов описаний
    descriptions = defaultdict(list)
    for u in unis:
        desc = u.get("description", "").strip()
        if desc:
            descriptions[desc].append(u["id"])
            
    dup_desc = {k: v for k, v in descriptions.items() if len(v) > 1}
    print(f"\n[1] Duplicate descriptions found: {len(dup_desc)}")
    for desc, ids in dup_desc.items():
        print(f"  - Count: {len(ids)} | {ids} | Snippet: {desc[:100]}...")
        
    # 2. Проверка дублирования списков программ под копирку
    program_sets = defaultdict(list)
    for u in unis:
        progs = tuple(sorted([p.get("name", "") for p in u.get("academics", {}).get("programs", [])]))
        if progs:
            program_sets[progs].append(u["id"])
            
    dup_progs = {k: v for k, v in program_sets.items() if len(v) > 1}
    print(f"\n[2] Duplicate exact program lists found: {len(dup_progs)}")
    for progs, ids in dup_progs.items():
        if len(progs) > 1: # Пропускаем пустые или с одной программой (хотя это тоже подозрительно)
            print(f"  - Count: {len(ids)} | {ids} | Programs: {list(progs[:5])}...")
            
    # 3. Проверка подозрительно одинаковых зарплат (outcomes)
    salaries = defaultdict(list)
    for u in unis:
        sal = u.get("outcomes", {}).get("average_early_career_salary_usd")
        if sal is not None:
            salaries[sal].append(u["id"])
            
    dup_salaries = {k: v for k, v in salaries.items() if len(v) > 1}
    print(f"\n[3] Duplicate outcomes.average_early_career_salary_usd: {len(dup_salaries)}")
    for sal, ids in dup_salaries.items():
        print(f"  - Salary: ${sal} | {ids}")
        
    # 4. Проверка подозрительно одинаковой стоимости обучения (tuition)
    tuitions = defaultdict(list)
    for u in unis:
        t = u.get("finance", {}).get("total_cost_year_usd")
        if t is not None:
            tuitions[t].append(u["id"])
            
    dup_tuitions = {k: v for k, v in tuitions.items() if len(v) > 1}
    print(f"\n[4] Duplicate finance.total_cost_year_usd: {len(dup_tuitions)}")
    for t, ids in dup_tuitions.items():
        print(f"  - Tuition: ${t} | Count: {len(ids)} | {ids[:10]}...")

    # 5. Проверка пустых/нулевых критических полей
    print("\n[5] Missing or suspicious zero/null values:")
    for u in unis:
        uid = u["id"]
        warnings = []
        
        # Стоимость обучения
        t = u.get("finance", {}).get("total_cost_year_usd")
        if t is None:
            warnings.append("tuition is null")
        elif t == 0:
            # Некоторые могут быть бесплатными (например, в Германии/Скандинавии), но проверим, где это
            country = u.get("location", {}).get("country", "")
            if country not in ["Germany", "Switzerland"]: # EPFL/ETH тоже имеют небольшую плату, но total_cost_year_usd может включать проживание
                warnings.append(f"tuition is $0 in {country}")
                
        # Acceptance rate
        acc = u.get("academics", {}).get("acceptance_rate_percent")
        if acc is None:
            warnings.append("acceptance_rate is null")
        elif acc == 0:
            warnings.append("acceptance_rate is 0%")
            
        # Описание
        desc = u.get("description", "")
        if not desc:
            warnings.append("description is empty")
        elif len(desc) < 50:
            warnings.append(f"description is too short ({len(desc)} chars)")
            
        # Программы
        progs = u.get("academics", {}).get("programs", [])
        if not progs:
            warnings.append("programs list is empty")
        elif len(progs) < 3:
            warnings.append(f"programs count is very low ({len(progs)})")
            
        if warnings:
            print(f"  - {uid}: {', '.join(warnings)}")

    # 6. Расхождения с official_facts.json
    if facts:
        print("\n[6] Discrepancies with official_facts.json:")
        fact_unis = facts.get("universities", {})
        for uid, f_data in fact_unis.items():
            # Найти этот универ в unis list
            u_matched = next((x for x in unis if x["id"] == uid), None)
            if not u_matched:
                print(f"  - {uid} is in official_facts but missing from universities.json!")
                continue
                
            # Проверить student_count
            f_sc = f_data.get("student_count", {}).get("value")
            u_sc = u_matched.get("student_count")
            if f_sc is not None and u_sc != f_sc:
                print(f"  - {uid}: student_count discrepancy! facts={f_sc}, universities={u_sc}")
                
            # Проверить acceptance_rate
            f_ar = f_data.get("acceptance_rate_percent", {}).get("value")
            u_ar = u_matched.get("academics", {}).get("acceptance_rate_percent")
            if f_ar is not None and u_ar != f_ar:
                print(f"  - {uid}: acceptance_rate discrepancy! facts={f_ar}, universities={u_ar}")
                
            # Проверить description
            f_desc = f_data.get("description", {}).get("value")
            u_desc = u_matched.get("description")
            if f_desc is not None and u_desc != f_desc:
                print(f"  - {uid}: description discrepancy!")

    # 7. Расхождения с official_admissions.json
    if admissions:
        print("\n[7] Discrepancies with official_admissions.json:")
        adm_unis = admissions.get("universities", {})
        for uid, a_data in adm_unis.items():
            u_matched = next((x for x in unis if x["id"] == uid), None)
            if not u_matched:
                print(f"  - {uid} is in official_admissions but missing from universities.json!")
                continue
            
            # Сравнить admissions объект
            u_adm = u_matched.get("academics", {}).get("admissions", {})
            
            # Проверить university_wide acceptance rate
            a_uw_rate = a_data.get("university_wide", {}).get("acceptance_rate_percent")
            u_uw_rate = u_adm.get("university_wide", {}).get("acceptance_rate_percent") if u_adm else None
            if a_uw_rate is not None and u_uw_rate != a_uw_rate:
                print(f"  - {uid}: university_wide acceptance_rate discrepancy! admissions={a_uw_rate}, universities={u_uw_rate}")

    # 8. Проверка локализации (переводов)
    if translations:
        print("\n[8] Translation issues:")
        langs = translations.get("languages", {})
        rus = langs.get("rus", {})
        ru_names = rus.get("university_names", {})
        ru_descs = rus.get("university_descriptions", {})
        
        for u in unis:
            uid = u["id"]
            if uid not in ru_names:
                print(f"  - {uid}: missing Russian name translation!")
            if uid not in ru_descs:
                print(f"  - {uid}: missing Russian description translation!")


if __name__ == "__main__":
    audit()
