# Перенос пользовательского состояния на backend при Google Auth

Этот документ фиксирует frontend-логики, которые сейчас живут в `localStorage` / `sessionStorage`, но должны стать серверным пользовательским состоянием после перехода на профили через Google авторизацию.

Цель: после входа через Google пользователь должен видеть один и тот же профиль, избранное, фильтры и историю на разных устройствах. `localStorage` можно оставить только как offline/cache слой и для гостевого режима.

## Текущие client-side состояния

### Профиль пользователя

- Ключ: `unisearch_profile`
- Основные функции: `loadProfile`, `saveProfile`, `loadProfileForApi`, `normalizeProfileData`
- Файл: `frontend/javascript/utils.js`
- Использование:
  - `frontend/javascript/components.js` — модалка профиля, сохранение/сброс данных.
  - `frontend/javascript/pages/universities.js` — UniFit/сортировка, бюджет, funding type, payload для AI-sort.
  - `frontend/javascript/pages/university.js` — UniChance, ROI, стоимость по формату обучения.
  - `frontend/javascript/university-detail-helpers.js` — отображение admission/score контекста.
  - `frontend/javascript/languages.js` — языки профиля.
- Что хранится:
  - `name`
  - `budget`
  - `gpa`
  - `exams`
  - `languages`
  - `major`
  - `interests`
  - `studyMode`
  - `fundingType`
  - `selectedAdmissionChoices`

Backend target:
- Таблица/коллекция `user_profiles`.
- Привязка к `user_id` Google account.
- Версионирование схемы профиля, потому что exam/language форматы уже меняются.
- API:
  - `GET /me/profile`
  - `PUT /me/profile`
  - возможно `PATCH /me/profile` для отдельных секций.

Важно:
- `selectedAdmissionChoices` сейчас внутри профиля, но логически это отдельное user-state. При переносе лучше вынести отдельно, чтобы смена профиля не стирала выбор варианта поступления.

### Выбранные варианты поступления

- Сейчас хранится внутри `unisearch_profile.selectedAdmissionChoices`
- Основные функции: `getSelectedAdmissionChoice`, `saveSelectedAdmissionChoice`
- Файл: `frontend/javascript/utils.js`
- Использование:
  - `frontend/javascript/pages/university.js` — выбор активного admission choice на detail-странице.

Формат сейчас:

```json
{
  "selectedAdmissionChoices": {
    "mit-usa-cambridge": {
      "programId": "computer_science",
      "programName": "Computer Science",
      "categoryId": "regular_undergraduate",
      "requirementProfileId": "sat",
      "fundingOptionId": "paid",
      "choiceKey": "regular_undergraduate::sat::paid"
    }
  }
}
```

Backend target:
- Таблица/коллекция `user_selected_admission_choices`.
- Поля:
  - `user_id`
  - `university_id`
  - `program_id`
  - `program_name`
  - `category_id`
  - `requirement_profile_id`
  - `funding_option_id`
  - `choice_key`
  - `updated_at`
- API:
  - `GET /me/selected-admission-choices`
  - `PUT /me/universities/{university_id}/selected-admission-choice`
  - `DELETE /me/universities/{university_id}/selected-admission-choice`

### Избранные университеты

- Ключ: `unisearch_saved_university_ids_v1`
- Константа: `SAVED_UNIVERSITIES_KEY`
- Helpers: `readIdListStorage`, `writeIdListStorage`
- Файл с ключами: `frontend/javascript/pages/_shared.js`
- Основная логика UI: `frontend/javascript/pages/universities.js`
- Использование:
  - кнопка star на карточке университета.
  - фильтр `only_saved` / «Только избранные».

Формат сейчас:

```json
["mit-usa-cambridge", "stanford-university-usa-ca"]
```

Backend target:
- Таблица/коллекция `user_favorite_universities`.
- Поля:
  - `user_id`
  - `university_id`
  - `created_at`
  - `updated_at`
- API:
  - `GET /me/favorite-universities`
  - `PUT /me/favorite-universities/{university_id}`
  - `DELETE /me/favorite-universities/{university_id}`

Важно:
- Фильтр `only_saved` должен после миграции работать через backend, а не через клиентскую фильтрацию полного списка.

### Недавно открытые университеты

- Ключ: `unisearch_recent_university_ids_v1`
- Константа: `RECENT_UNIVERSITIES_KEY`
- Лимит: `MAX_RECENT_UNIVERSITIES = 12`
- Helper: `rememberRecentUniversity`
- Файл с ключами: `frontend/javascript/pages/_shared.js`
- Использование:
  - `frontend/javascript/pages/universities.js` — клик по карточке добавляет/перемещает университет наверх.
  - `frontend/javascript/pages/university.js` — открытие detail-страницы добавляет/перемещает университет наверх.

Формат сейчас:

```json
["mit-usa-cambridge", "harvard-usa-cambridge"]
```

Backend target:
- Таблица/коллекция `user_recent_universities`.
- Поля:
  - `user_id`
  - `university_id`
  - `viewed_at`
  - `view_count` опционально.
- API:
  - `GET /me/recent-universities?limit=12`
  - `POST /me/recent-universities/{university_id}/view`
  - `DELETE /me/recent-universities`

Важно:
- Хранить только ID, название всегда получать из university data/translation layer.
- Повторное открытие должно делать upsert и поднимать запись наверх.

### Фильтры каталога университетов

- Ключ: `unisearch_filters`
- Основные функции: `saveFilters`, `loadFilters`
- Файл: `frontend/javascript/utils.js`
- Использование: `frontend/javascript/pages/universities.js`

Поля сейчас:
- `q`
- `country`
- `region`
- `city`
- `study_level`
- `only_saved`
- `min_tuition`
- `max_tuition`
- `sort`
- `practice_vs_science`
- `social_vs_hardcore`
- `budget_vs_prestige`
- `city_vs_campus`
- `viewMode`

Backend target:
- Таблица/коллекция `user_catalog_preferences` или `user_saved_filter_state`.
- Поля:
  - `user_id`
  - `filters_json`
  - `updated_at`
- API:
  - `GET /me/university-filters`
  - `PUT /me/university-filters`
  - `DELETE /me/university-filters`

Важно:
- Это скорее preference/state, не обязательная бизнес-сущность.
- `only_saved` зависит от server-side favorite state.
- `funding_type` сейчас берётся из профиля (`profile.fundingType`), не из сохранённых фильтров.

### Университеты для сравнения

- Ключ: `unisearch_compare_university_ids_v1`
- Константа: `COMPARE_UNIVERSITIES_KEY`
- Лимит: `MAX_COMPARE_UNIVERSITIES = 8`
- Файл с ключами: `frontend/javascript/pages/_shared.js`
- Основная логика UI: `frontend/javascript/pages/universities.js`

Формат сейчас:

```json
["mit-usa-cambridge", "stanford-university-usa-ca"]
```

Backend target:
- Можно хранить как `user_compare_universities`, если compare должен переживать устройство/сессию.
- Если compare считается временным рабочим состоянием, можно оставить в клиенте или хранить в server session.
- API при серверном хранении:
  - `GET /me/compare-universities`
  - `PUT /me/compare-universities`
  - `DELETE /me/compare-universities`

## Дополнительные состояния, которые стоит решить отдельно

Эти данные не входят в обязательный перенос, но нужно принять решение до Google Auth:

- UI language: `unisearch_ui_language_v1`
  - Файлы: `frontend/javascript/i18n.js`, `frontend/javascript/utils.js`
  - Можно хранить как user preference.
- Theme: `unisearch_theme`
  - Файлы: `frontend/javascript/theme-init.js`, `frontend/javascript/utils.js`
  - Можно хранить как user preference, но локальный fallback нормален.
- Universities tour seen: `unisearch_universities_tour_seen_v1`
  - Файл: `frontend/javascript/pages/_shared.js`
  - Можно хранить как onboarding state.
- Detail cache: `unisearch_detail_cache_v3`
  - Файл: `frontend/javascript/pages/_shared.js`
  - Не переносить в базу. Это frontend cache.
- Profile draft transfer: sessionStorage в `frontend/javascript/components.js`
  - Не переносить в базу. Это временная передача черновика внутри UI.
- Backend wake ping: sessionStorage в `frontend/javascript/main.js`
  - Не переносить.
- Header layout cache: localStorage в `frontend/javascript/components.js`
  - Не переносить.

## Предлагаемая схема backend-моделей

Минимальный набор:

```text
users
- id
- google_sub
- email
- name
- avatar_url
- created_at
- updated_at

user_profiles
- user_id
- profile_json
- schema_version
- created_at
- updated_at

user_favorite_universities
- user_id
- university_id
- created_at
- updated_at

user_recent_universities
- user_id
- university_id
- viewed_at
- view_count

user_selected_admission_choices
- user_id
- university_id
- choice_key
- updated_at

user_catalog_preferences
- user_id
- filters_json
- updated_at

user_compare_universities
- user_id
- university_ids_json
- updated_at
```

Позже можно нормализовать `profile_json`, но на первом этапе JSON проще: текущий профиль содержит вложенные exams/languages/details, и их формат ещё может меняться.

## Миграционная стратегия

1. Добавить Google Auth и endpoint `GET /me`.
2. Добавить backend API для профиля, избранного, recent, фильтров и выбранных вариантов поступления.
3. На frontend сделать `userState` слой:
   - authenticated: читать/писать через API;
   - guest: читать/писать через текущий localStorage.
4. При первом входе предложить импортировать локальные данные:
   - профиль;
   - избранные;
   - недавно открытые;
   - фильтры;
   - выбранные варианты поступления;
   - compare, если решим сохранять.
5. После успешного импорта не удалять localStorage сразу. Лучше поставить marker `imported_to_user_id`, чтобы избежать повторного импорта и дать rollback.
6. Все server writes делать optimistic с откатом UI при ошибке.
7. Для merge правил:
   - профиль: server wins, если он свежее; иначе local draft можно предложить импортировать.
   - избранные: union.
   - recent: merge по `viewed_at`, максимум 12.
   - фильтры: last updated wins.
   - selected admission choices: last updated per university wins.

## Где начинать рефакторинг

1. `frontend/javascript/utils.js`
   - вынести `loadProfile/saveProfile`, `loadFilters/saveFilters`, `getSelectedAdmissionChoice/saveSelectedAdmissionChoice` за интерфейс `userState`.
2. `frontend/javascript/pages/_shared.js`
   - вынести `readIdListStorage/writeIdListStorage/rememberRecentUniversity` в тот же слой или отдельный `userUniversityState`.
3. `frontend/javascript/pages/universities.js`
   - заменить прямое чтение `Set(readIdListStorage(...))` на async загрузку user state.
   - фильтр `only_saved` должен использовать backend query.
4. `frontend/javascript/pages/university.js`
   - заменить `rememberRecentUniversity` и selected admission choice helpers на API-aware слой.
5. Backend:
   - добавить user модели и endpoints до переписывания UI, чтобы frontend можно было переключать постепенно.

## Open questions

- Сохраняем ли compare между устройствами или оставляем как временное состояние текущего браузера?
- Нужно ли хранить несколько filter presets или только последний catalog state?
- Должен ли профиль поддерживать несколько applicant profiles на одного Google user?
- Нужно ли отдельное audit/history для profile changes, если UniChance будет зависеть от сохранённых данных?
- Нужно ли удаление аккаунта чистить все user-state таблицы сразу или через soft delete?
