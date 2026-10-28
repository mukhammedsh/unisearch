# Retired catalog history

`admissions-cutover-2026-10-13.json` preserves the complete MIT, Imperial College London and Stanford University records from the former `universities.json` contract before their coordinated cutover. It retains source references and values that may be useful for historical reconciliation, including records not represented by identical source URLs in the accepted snapshot.

`admissions-cutover-2026-10-25.json` preserves Nazarbayev University's previous record and retired admissions/acceptance-rate synchronization inputs. Common institution facts remain active; its former seven-program list, exam/funding categories and uniform tuition are replaced by the reviewed catalog.

These records are inactive, are not newly reviewed, and are not loaded by the application. `retired_at` is the migration date, not a source-check date. Do not copy their thresholds, costs, funding outcomes or old selection IDs into the active admissions catalog without a scoped official-source review. Current study options and admissions facts belong to `backend/data/admissions/catalog.json`; the four `universities.json` rows retain common institution information and an `admissions_catalog_id` reference.

The other 46 rows retain their existing contract until their own reviewed cutover. This archive is data preservation, not an alternative runtime reader.
