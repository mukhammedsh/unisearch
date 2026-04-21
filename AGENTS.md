# AGENTS.md — UniSearch AI Protocol

## 1. ОБЩИЕ ПРАВИЛА
- **Язык:** Строго русский (если не просят иное).
- **Скоуп:** Только бакалавриат. (Магистратуру/PhD игнорировать).
- **Разработка:** Строго по аналогии. Сначала ищи паттерн в коде/дизайне, потом пиши. Не трогай файлы вне задачи.
- **Commits:** Осмысленные, от лица пользователя (не бота).

## 2. СТЕК И АРХИТЕКТУРА
- **Frontend:** Vanilla JS, HTML, CSS (`frontend/`).
- **Backend:** Python 3.12+, FastAPI (`backend/app/`).
- **Стили/UI:** Никаких фреймворков, только CSS variables из `frontend/css/style.css`.
- **Локализация:** English / Русский (`frontend/Localization/`). Хардкод текста в UI/JS запрещен.
- **Иконки:** Строго Heroicons (`frontend/javascript/icons.js`). Синхронизация: `npm run sync:heroicons`.
- **Данные:** JSON-хранилище (`backend/data/`). Медиа в `university_assets/`.
- **Тесты:** Playwright E2E (`tests/e2e/`), Pytest (`backend/tests/`).

## 3. UI/UX (Calm Academic Workspace)
- **Стиль:** Рабочий инструмент. Запрещены SaaS/AI-landing стили, Tailwind-палитры, плоские `shadow-md`.
- **Структура экранов:** Scope/status → toolbar/filter → данные.
- **Карточки:** `border: 1px solid var(--line)`, `background: var(--surface-solid)`, радиус 16–20px. Никаких вложенных карточек.
- **Взаимодействие:** Поддержка Light/Dark themes, `hover/active/focus` состояний, `aria-label` для кнопок.
- **Вкладки:** Только `underline-tabs` (не pill tabs).
- **Анимации:** Только `opacity` и `transform` (spring-style). Запрещено `transition-all`. Для вкладок разделов (Navbar, профиль, универ, фильтры) смена категории должна быть со sliding эффектом ползунка (смещение влево/вправо).
- **Состояния:** Обязательно покрыть Loading (skeletons), Empty, Error. Без технических ошибок в UI.

## 4. КЛЮЧЕВАЯ ЛОГИКА
- **UniFit:** `services/ai_scoring.py` (комплексное ранжирование).
- **UniChance:** Точный расчет требует `score_profile`.
- **ML Scoring:** `services/ml_scoring.py` (Embeddings multilingual-e5 -> TF-IDF).
- API-адреса не хардкодить, брать из runtime-конфигов.

## 5. ДАННЫЕ ВУЗОВ
- **Источники фактов:** Того офф. сайты и admission PDF. Агрегаторы запрещены. Лучше пустота, чем фейк (исключение: proxy-estimate для factors UniFit).
- **Названия:** В UI только полные имена. Аббревиатуры убирать в скрытый `search_aliases`.
- **Медиа:** Лого 1:1 (PNG), Обложки 16:9 (JPG). ВУЗ должен быть узнаваем.

## 6. CHANGELOG И РЕЛИЗ (Release Workflow)
- **CHANGELOG.md & AGENTS.md:** Обновлять сухо, только по существу (изменения поведения/API, или важные паттерны), не писать воду и не обновлять без прямого смысла.
- **Steps для релиза:**
  1. `git diff` и `git status` (проверить отсутствие хвостов, хардкода, токенов).
  2. Поднять версию: `npm run bump:version -- [patch|minor|major|X.Y.Z]` (единый источник – `package.json`).
  3. Описать в `CHANGELOG.md` (в блок новой версии) изменения из текущего diff.
  4. Запустить минимальные тесты (`npm run check:i18n`, `npm run test:backend`).
  5. Commit + Push.
  6. Сделать тег: `git tag -a vX.Y.Z -m "UniSearch X.Y.Z"` -> `git push origin vX.Y.Z`.
  7. Контролировать GitHub Actions, выдать итоговый отчет со ссылками.

## 7. БЕЗОПАСНОСТЬ И COMPATIBILITY
- **Кроссплатформа:** Совместимость скриптов и путей c Windows, Mac, Linux. Без абсолютных путей.
- **Секреты:** IP, Токены, API-ключи, `.env` вычищать из staged files перед коммитом и пушем. Использовать `env.example`.
