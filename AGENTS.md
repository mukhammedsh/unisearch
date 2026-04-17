# AGENTS.md — UniSearch Project Instructions

## Базовые правила
- Всегда отвечай на русском языке, если пользователь не попросил иное.
- UniSearch — open-source веб-приложение MIT для подбора университета по профилю пользователя.
- Текущую версию смотри в `package.json` → `version`.
- Уровень обучения сейчас только бакалавриат. Магистратуру, PhD и другие уровни не реализовывать без прямого запроса на изменение продуктового скоупа.
- Перед изменениями найди ближайший существующий аналог и следуй локальному паттерну проекта.
- Не коммить от имени бота. Commit message должен быть осмысленным.

## Стек и структура
- Frontend: Vanilla JS + HTML + CSS без фреймворков, страницы в `frontend/`.
- Backend: Python 3.12+ / FastAPI, код в `backend/app/`.
- Данные: JSON в `backend/data/`.
- Медиа университетов: `backend/data/university_assets/`.
- Локализация: English и Русский в `frontend/Localization/`.
- Темы: светлая и тёмная, обе всегда должны работать.
- Иконки: только Heroicons из `frontend/javascript/icons.js`; синхронизация через `npm run sync:heroicons`.
- Тесты: pytest для backend, Playwright для E2E, отдельная проверка i18n.

Ключевые зоны:
```text
backend/app/routers/      API endpoints
backend/app/services/     business logic: ai_scoring, ml_scoring, search, etc.
backend/app/schemas/      Pydantic schemas
backend/data/             datasets and official_facts.json
backend/tests/            pytest tests

frontend/*.html           pages
frontend/css/             styles
frontend/javascript/      components, pages, utils, i18n, icons, routes
frontend/Localization/    translation files

tests/e2e/                Playwright specs
scripts/                  root dev/test scripts
docs/                     project documentation
```

## Ключевые функции
- UniFit: `POST /universities/ai-sort`, логика в `backend/app/services/ai_scoring.py`; сортирует университеты по экзаменам, профилю, интересам и 4 ползункам.
- UniChance: `POST /universities/{id}/uni-chance`; точный режим при наличии `score_profile`, иначе fallback с низкой точностью.
- ML scoring: `backend/app/services/ml_scoring.py`; multilingual-e5 embeddings, fallback TF-IDF cosine similarity.
- Перевод интересов: `backend/app/services/text_translation.py`, LibreTranslate.

## Универсальный workflow
Перед добавлением новой сущности сначала найди аналог:
- страница → `frontend/*.html`, `frontend/javascript/pages/` или текущий паттерн page-модулей;
- компонент → `frontend/javascript/components/` или существующий UI-код;
- стили → ближайший файл в `frontend/css/`;
- API endpoint → `backend/app/routers/`;
- бизнес-логика → `backend/app/services/`;
- схема → `backend/app/schemas/`;
- backend-тест → похожий файл в `backend/tests/`;
- E2E-тест → похожий сценарий в `tests/e2e/`.

Сохраняй изменения узкими. Не делай unrelated refactor, форматирование или переезд файлов без необходимости для задачи.

## Definition of Done
Перед финальным ответом проверь применимое:
- Пользовательские строки локализованы на English и Русский; нет нового видимого текста, зашитого в JS/HTML без i18n.
- Light и dark themes поддержаны.
- Используются только Heroicons из `frontend/javascript/icons.js`.
- Интерактивные элементы имеют hover, active и focus-visible состояния.
- Доступность не ухудшена: есть keyboard-friendly поведение и `aria-label` для icon-only кнопок.
- Loading, empty и error states обработаны для UI, зависящего от данных/API.
- API errors не показываются пользователю как сырые технические ошибки.
- Ограничение bachelor-only не нарушено.
- Для изменённого поведения добавлены или обновлены релевантные тесты.
- Запущена минимальная релевантная проверка или явно указано, почему её не удалось запустить.

## Новая страница
Если пользователь просит добавить страницу, проверь и обнови:
- HTML-файл в `frontend/`.
- JS-модуль страницы по существующему паттерну проекта.
- CSS в подходящем файле `frontend/css/`.
- Навигацию, ссылки, роутинг и 404/empty-состояния, если страница должна быть доступна из UI.
- Переводы English и Русский.
- Title/meta, основные `aria-label`, адаптивность, mobile/tablet overflow.
- E2E-тест или ручную проверку страницы.
- `CHANGELOG.md`, если изменение заметно пользователю.

Новая страница должна быть рабочим экраном, а не декоративным лендингом, если лендинг не попросили явно.

## UI и дизайн
- Избегай «ИИшного» дизайна: дефолтных Tailwind-палитр, пластиковых градиентов и generic SaaS-вида.
- Тени — многослойные, с цветовым оттенком и низкой прозрачностью; не плоские `shadow-md`.
- Типографика — парные шрифты, заголовки отличаются от тела текста; tight tracking допустим для заголовков.
- Глубина — слои base → elevated → floating, элементы не должны выглядеть на одной плоскости.
- Анимации — только `transform` и `opacity`; не использовать `transition-all`; easing ближе к spring-style.
- Не делай вложенные card-in-card структуры.
- Фиксированные UI-элементы должны иметь стабильные размеры, чтобы контент не прыгал при загрузке.
- Текст не должен налезать на соседние элементы на mobile и desktop.

## Frontend/API правила
- Не хардкодь backend URL, используй существующий runtime config (`frontend/config.js`, `frontend/env.js` или локальный паттерн).
- Обрабатывай network error, пустой ответ и невалидные данные.
- Если меняется контракт API, обнови backend schema/tests и frontend обработку вместе.
- Не добавляй новые зависимости без явной пользы и проверки, что они подходят open-source проекту.

## Данные университетов
- Университетские факты бери только из официальных источников: сайты университетов, официальные admission pages, PDF-отчёты.
- Не используй агрегаторы, маркетинговые пересказы и неверифицированные источники.
- Исключение: `factors` для ползунков UniFit можно оценивать приблизительно, потому что официальных данных обычно нет.
- Лучше пустое поле, чем фейковые данные.
- В отображаемом названии университета не используй аббревиатуры: полное название обязательно.
- Аббревиатуры добавляй только в скрытый `search_aliases`.

Workflow обновления фактов:
```bash
python backend/scripts/apply_official_facts.py --verified-at YYYY-MM-DD
python backend/scripts/audit_universities_data.py
python backend/scripts/audit_universities_data.py --check-http --http-timeout 10
```

## Медиа университетов
- Логотип: PNG, 1:1, примерно 200×200 px, файл `backend/data/university_assets/logos/{university-id}.png`.
- Логотип small: примерно 100×100 px в `logos-small/`.
- Превью: JPG, 16:9, примерно 1600×900 px, виден сам университет, файл `thumbnails/{university-id}.jpg`.
- Превью small: примерно 800×450 px в `thumbnails-small/`.
- Не используй изображения, где университет нельзя распознать.

## Тесты и проверки
- i18n: `npm run check:i18n`.
- Backend: `npm run test:backend`.
- E2E PR Chromium: `npm run test:e2e:pr`.
- Полный прогон: `npm run test:all`.

Минимальная матрица:
- Только тексты/переводы → `npm run check:i18n`.
- Frontend UI → `npm run check:i18n` + ручная проверка light/dark и responsive.
- Новая/изменённая страница → i18n + релевантный Playwright test или ручная проверка.
- Backend logic/API → `npm run test:backend`.
- Данные университетов → scripts из workflow обновления данных + audit.
- Большое изменение → `npm run test:all`.

## CHANGELOG
Обновляй `CHANGELOG.md`, если изменение:
- добавляет пользовательскую функцию;
- меняет поиск, ранжирование, профиль, карточки университетов или UniChance/UniFit;
- меняет структуру данных или API;
- исправляет заметный пользовательский баг.

Не обновляй changelog для чистого рефакторинга, форматирования или внутренних тестовых правок без изменения поведения.

## Запуск проекта
```bash
# Backend
cd backend && python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd .. && npm run dev:backend

# Frontend, отдельный терминал
npm run dev:frontend

# Открыть
http://127.0.0.1:5501/index.html
```

## Безопасность и совместимость
- Проект должен оставаться удобным для Windows, macOS и Linux.
- Не добавляй личные данные, API-ключи, токены, IP-адреса и `.env` в репозиторий.
- Используй `.env.example` как шаблон для конфигурации.
- Учитывай разные варианты хостинга: VPS, Docker, managed platforms.
