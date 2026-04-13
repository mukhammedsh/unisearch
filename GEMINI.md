# GEMINI.md — UniSearch Project Instructions

## Язык общения
Всегда отвечай на **русском языке**, если пользователь не попросит иное.

## О проекте
UniSearch — open-source веб-приложение (MIT лицензия) для подбора идеального университета.
Пользователь заполняет профиль (экзамены, предпочтения, интересы), а система с помощью ИИ-функций подбирает и ранжирует университеты.

**Текущая версия:** см. `package.json` → `version`
**Уровень обучения:** ТОЛЬКО бакалавриат (другие уровни — в планах на будущее, пока не реализовывать).

## Стек технологий
- **Frontend:** Vanilla JS + HTML + CSS (без фреймворков), страницы в `frontend/`
- **Backend:** Python 3.12+ / FastAPI, код в `backend/app/`
- **Данные:** JSON-файлы в `backend/data/`
- **Медиа:** `backend/data/university_assets/` (логотипы, миниатюры)
- **Тесты:** Playwright (E2E), pytest (backend), скрипт проверки i18n
- **CI:** GitHub Actions (`.github/workflows/tests.yml`)
- **Иконки:** Heroicons (скрипт синхронизации: `npm run sync:heroicons`)
- **Локализация:** два языка — English и Русский (`frontend/Localization/`)
- **Темы:** светлая и тёмная (обе должны быть всегда поддержаны)

## Структура проекта
```
backend/
  app/
    main.py            # FastAPI entry point
    core/              # config, env, redis, security, settings
    routers/           # API endpoints (root, universities, exams, languages)
    schemas/           # Pydantic models
    services/          # business logic (ai_scoring, ml_scoring, search, etc.)
  data/                # JSON datasets + university_assets/
  scripts/             # data maintenance scripts
  tests/               # pytest unit tests

frontend/
  *.html               # pages: index, universities, university, ranking, guide, about
  config.js / env.js   # runtime config
  css/                 # stylesheets
  javascript/          # JS modules (components, pages, utils, i18n, icons, routes...)
  Localization/        # translation files (en, ru)
  images/              # static images
  scripts/             # build scripts (generate-env-js)

docs/                  # project documentation
scripts/               # root-level dev scripts (i18n-check, dev-backend, dev-frontend...)
tests/e2e/             # Playwright E2E specs
```

## ИИ-функции (ключевые фичи)

### UniFit (AI-сортировка)
- Эндпоинт: `POST /universities/ai-sort`
- Ранжирует университеты от самого подходящего к наименее подходящему
- Учитывает: экзамены пользователя, предпочтения из профиля, 4 ползунка настройки
- Бэкенд: `backend/app/services/ai_scoring.py`

### UniChance (шанс поступления)
- Эндпоинт: `POST /universities/{id}/uni-chance`
- Два режима:
  1. **Точный** — когда у университета есть `score_profile`, показывает точный шанс
  2. **Fallback** — приблизительная оценка с низкой точностью
- Использует данные профиля пользователя

### ML-модель + переводчик
- Semantic embeddings (`intfloat/multilingual-e5-base`) для ранжирования по интересам
- Fallback: TF-IDF cosine similarity
- Переводчик (LibreTranslate) переводит интересы пользователя для лучшей сортировки
- Бэкенд: `backend/app/services/ml_scoring.py`, `backend/app/services/text_translation.py`

## Правила дизайна (Anti-AI Design)

### Общие принципы
- **Избегай «ИИшного» дизайна** — никаких дефолтных Tailwind-палитр, пластиковых градиентов
- **Тени:** многослойные, с цветовым оттенком и низкой прозрачностью — не плоские `shadow-md`
- **Типографика:** используй парные шрифты (заголовки ≠ тело текста), tight tracking на заголовках
- **Глубина:** система слоёв (base → elevated → floating), элементы не на одной z-плоскости
- **Анимации:** анимируй только `transform` и `opacity`, никогда `transition-all`, spring-style easing
- **Интерактивность:** каждый кликабельный элемент обязан иметь hover, focus-visible, active состояния

### Специфика проекта
- Иконки: **только Heroicons** (`frontend/javascript/icons.js`)
- Темы: **всегда поддерживай и светлую, и тёмную**
- Локализация: **всегда добавляй перевод на русский**, качественный и естественный (не машинный)
- Если создаёшь файл перевода — обнови оба языка в `frontend/Localization/`

## Точность данных (КРИТИЧНО)

### Правила
- **Университетские данные берём ТОЛЬКО из официальных источников:** сайты университетов, официальные страницы приёма, PDF-отчёты университетов
- **НЕ использовать:** агрегаторы, маркетинговые пересказы, неверифицированные источники
- **Исключение:** `factors` для ползунков UniFit — их невозможно найти официально, допускается приблизительное значение на основе отзывов в интернете
- **Лучше пустое поле, чем фейковые данные**

### Workflow обновления данных
1. Обновить факты в `backend/data/official_facts.json`
2. Синхронизировать: `python backend/scripts/apply_official_facts.py --verified-at YYYY-MM-DD`
3. Аудит: `python backend/scripts/audit_universities_data.py`
4. HTTP-аудит: `python backend/scripts/audit_universities_data.py --check-http --http-timeout 10`

## Названия университетов
- **Никогда не используй аббревиатуры** в отображаемом названии — всегда полное название (например, «Massachusetts Institute of Technology», а не «MIT»)
- Аббревиатуры и сокращения добавляй в скрытый от пользователя список `search_aliases` — они используются только для поиска

## Медиа-активы университетов

### Логотип (`logos/`)
- **Формат:** PNG, соотношение сторон **1:1**
- **Разрешение:** ~200×200 px
- Логотип должен занимать **почти весь размер** изображения
- **Избегай** мелкого текста, который будет нечитаемым на маленьких размерах
- Файл: `backend/data/university_assets/logos/{university-id}.png`

### Превью / фон (`thumbnails/`)
- **Формат:** JPG, соотношение сторон **16:9**
- **Разрешение:** ~1600×900 px
- На фото должен быть **виден сам университет** (кампус, здание)
- Файл: `backend/data/university_assets/thumbnails/{university-id}.jpg`

### Small-варианты (оптимизация)
- `logos-small/` и `thumbnails-small/` — версии с **вдвое уменьшенным** разрешением
- Логотип small: ~100×100 px
- Превью small: ~800×450 px
- Используются на страницах списков и карточках для экономии трафика

## Правила кодирования

### Структура и организация
- **Разбивай большие файлы** на мелкие модули по папкам — удобнее редактировать и находить нужное
- **Группируй** по функциональности: routers/, services/, core/, schemas/ (бэкенд); components, pages, utils (фронтенд)

### Open-source и совместимость
- Проект для всех пользователей: Windows, macOS, Linux
- **Не сливай** личные данные, API-ключи, IP-адреса в репозиторий
- `.env` файлы в `.gitignore`, используй `.env.example` как шаблон
- Делай удобство для любого хостинга (VPS, Docker, managed platforms)

### Git
- Коммиты делай **от имени пользователя** (не от бота)
- Пиши осмысленные commit messages

### Тестирование
- Backend: `npm run test:backend` (pytest)
- E2E: `npm run test:e2e:pr` (Playwright, Chromium)
- i18n: `npm run check:i18n`
- Полный прогон: `npm run test:all`

## Запуск проекта
```bash
# Backend
cd backend && python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd .. && npm run dev:backend

# Frontend (в отдельном терминале)
npm run dev:frontend

# Открыть: http://127.0.0.1:5501/index.html
```

## Полезные ссылки внутри проекта
- Changelog: `CHANGELOG.md`
- Документация: `docs/`
- API: см. README.md → «API overview»
- Конфиг окружения: `backend/.env.example`
