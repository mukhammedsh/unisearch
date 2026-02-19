from pathlib import Path

CORE_DIR = Path(__file__).resolve().parent
APP_DIR = CORE_DIR.parent
BACKEND_DIR = APP_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
UNIVERSITY_ASSETS_DIR = DATA_DIR / "university_assets"

DATA_PATH = str(DATA_DIR / "universities.json")
CITIES_PATH = str(DATA_DIR / "cities.json")
EXAMS_PATH = str(DATA_DIR / "exams.json")
LANGUAGES_PATH = str(DATA_DIR / "languages.json")
UNIVERSITIES_TRANSLATIONS_PATH = str(DATA_DIR / "universities_translations.json")
