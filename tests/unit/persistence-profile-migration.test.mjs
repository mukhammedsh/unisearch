import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  PROFILE_VERSION,
  isLegacyProfile,
  isFutureProfile,
  normalizeProfileData,
  loadProfile,
  loadProfileForApi,
  saveProfile,
  clearProfile,
} from '../../frontend/javascript/utils/persistence.js';

describe('persistence-profile-migration.test.mjs - Profile Normalization & Safe Legacy Migration', () => {
  let mockStore;
  let setItemCalls;

  beforeEach(() => {
    mockStore = {};
    setItemCalls = 0;
    const storageMock = {
      getItem: (key) => mockStore[key] ?? null,
      setItem: (key, value) => {
        setItemCalls += 1;
        mockStore[key] = String(value);
      },
      removeItem: (key) => {
        delete mockStore[key];
      },
    };
    global.localStorage = storageMock;
    global.window.localStorage = storageMock;
    clearProfile();
  });

  describe('PROFILE_VERSION, isLegacyProfile, and isFutureProfile detection', () => {
    test('exports canonical PROFILE_VERSION = 2', () => {
      assert.strictEqual(PROFILE_VERSION, 2);
    });

    test('detects unversioned and legacy profiles correctly', () => {
      // Unversioned profile
      assert.strictEqual(isLegacyProfile({ budget: 100 }), true);
      assert.strictEqual(isFutureProfile({ budget: 100 }), false);

      // Outdated version tag
      assert.strictEqual(isLegacyProfile({ _v: 1, budget: 100 }), true);
      assert.strictEqual(isFutureProfile({ _v: 1, budget: 100 }), false);

      // Modern version tag but contains legacy root keys
      assert.strictEqual(isLegacyProfile({ _v: 2, name: 'Alice' }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, budget_currency: 'USD' }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, funding_type: 'grant' }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, gpa_scale: 5 }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, gpa_raw: 4.85 }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, user_gpa_scale: 5 }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, study_level: 'Master' }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, familyIncome: 'under_85k' }), false);
      assert.strictEqual(isLegacyProfile({ _v: 2, family_income_bracket: 'under_85k' }), false);
      assert.strictEqual(isLegacyProfile({ _v: 2, family_income: 'under_85k' }), false);
      assert.strictEqual(isLegacyProfile({ _v: 2, citizenships: 'KZ, US' }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, country_of_education: 'KZ' }), true);
      assert.strictEqual(isLegacyProfile({ _v: 2, selected_admission_choices: {} }), true);

      // Contains legacy keys in exams
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        exams: [{ id: 'SAT', exam: 'SAT', score: 1400, rawValue: '1400' }],
      }), true);
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        exams: [{ id: 'SAT', exam: 'SAT', score: 1400, displayValue: '1400 pts' }],
      }), true);
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        exams: [{ id: 'SAT', score: 1400 }], // Missing exam alias
      }), true);

      // Contains legacy keys in languages
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        languages: [{ lang: 'en', kind: 'native' }],
      }), true);
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        languages: [{ code: 'en', kind: 'exam', examId: 'ielts', score: 7.0 }],
      }), true);
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        languages: [{ code: 'en', kind: 'exam', examId: 'ielts', score: 7.0, rawValue: '7.0' }],
      }), true);

      // Contains legacy keys in selectedAdmissionChoices
      assert.strictEqual(isLegacyProfile({
        _v: 2,
        selectedAdmissionChoices: {
          harvard: { choice_key: 'c1', program_id: 'p1' },
        },
      }), true);

      // Fully canonical profile with _v: 2
      const canonical = {
        _v: 2,
        budget: 50000,
        budgetCurrency: 'USD',
        gpa: 3.8,
        gpaScale: 4,
        exams: [{ id: 'SAT', exam: 'SAT', score: 1450, raw_value: '1450', display_value: '1450' }],
        languages: [{ code: 'en', kind: 'exam', exam: 'ielts', score: 7.5, raw_value: '7.5', display_value: '7.5' }],
        major: 'Computer Science',
        interests: 'AI and robotics',
        studyMode: 'Any',
        fundingType: 'grant',
        selectedAdmissionChoices: {
          harvard: {
            programId: 'cs',
            programName: 'Computer Science',
            categoryId: 'stem',
            requirementProfileId: 'req-1',
            fundingOptionId: 'grant-1',
            choiceKey: 'cs-grant-choice',
          },
        },
      };
      assert.strictEqual(isLegacyProfile(canonical), false);
      assert.strictEqual(isFutureProfile(canonical), false);

      // Non-objects / null
      assert.strictEqual(isLegacyProfile(null), false);
      assert.strictEqual(isLegacyProfile(undefined), false);
      assert.strictEqual(isLegacyProfile([]), false);
      assert.strictEqual(isLegacyProfile('not-an-object'), false);
    });

    test('future-version safety: profiles with _v > PROFILE_VERSION are NEVER treated as legacy', () => {
      const futureProfile = {
        _v: 3,
        futureFeatureFlag: true,
        futureArray: [1, 2, 3],
        budget: 40000,
        budgetCurrency: 'USD',
      };

      assert.strictEqual(isFutureProfile(futureProfile), true);
      assert.strictEqual(isLegacyProfile(futureProfile), false);

      const futureProfileHigher = { _v: 99, budget: 100 };
      assert.strictEqual(isFutureProfile(futureProfileHigher), true);
      assert.strictEqual(isLegacyProfile(futureProfileHigher), false);
    });
  });

  describe('Future-version preservation (No Downgrade & No Storage Overwrite)', () => {
    test('loadProfile() does NOT overwrite localStorage when reading future-version profile', () => {
      const futureStored = {
        _v: 3,
        budget: 60000,
        budgetCurrency: 'EUR',
        gpa: 3.9,
        gpaScale: 4,
        futureQuantumMetric: 99.8,
        experimentalTrack: 'Bio-AI',
      };
      mockStore['unisearch_profile'] = JSON.stringify(futureStored);

      const callsBefore = setItemCalls;
      const loaded = loadProfile();

      // Ensure setItem was NOT called (no destructive rewrite to localStorage)
      assert.strictEqual(setItemCalls, callsBefore, 'loadProfile() must NEVER write to localStorage for future versions');

      // Ensure future version and future fields were preserved
      assert.strictEqual(loaded._v, 3, 'Version must NOT be downgraded to 2');
      assert.strictEqual(loaded.futureQuantumMetric, 99.8, 'Future fields must not be stripped');
      assert.strictEqual(loaded.experimentalTrack, 'Bio-AI', 'Future fields must not be stripped');
      assert.strictEqual(loaded.budget, 60000);

      // Raw storage in localStorage must remain identical to original
      const storageRaw = JSON.parse(mockStore['unisearch_profile']);
      assert.strictEqual(storageRaw._v, 3);
      assert.strictEqual(storageRaw.futureQuantumMetric, 99.8);
    });

    test('normalizeProfileData preserves future version tag and unknown fields', () => {
      const futureData = {
        _v: 4,
        nextGenToken: 'xyz-999',
        gpa: 3.9,
        gpaScale: 4,
      };

      const normalized = normalizeProfileData(futureData);
      assert.strictEqual(normalized._v, 4, 'normalizeProfileData must preserve future _v > 2');
      assert.strictEqual(normalized.nextGenToken, 'xyz-999', 'normalizeProfileData must preserve unknown fields');
    });

    test('saveProfile() refuses to overwrite future-version profile in localStorage across full UI change cycle', () => {
      const futureStored = {
        _v: 3,
        budget: 75000,
        budgetCurrency: 'USD',
        gpa: 3.95,
        gpaScale: 4,
        aiPersonalizationV3: { algorithm: 'neural_v3', weights: [0.1, 0.9] },
        exams: [
          { id: 'SAT', exam: 'SAT', score: 1560, customV3Field: 'verified_score' },
        ],
      };
      const initialRawJson = JSON.stringify(futureStored);
      mockStore['unisearch_profile'] = initialRawJson;

      // 1. loadProfile()
      const loaded = loadProfile();
      assert.strictEqual(loaded._v, 3);
      assert.strictEqual(loaded.budget, 75000);

      // 2. Simulate UI modification
      const modifiedInUi = {
        ...loaded,
        budget: 10000,
      };

      // 3. saveProfile(modifiedInUi)
      const saveResult = saveProfile(modifiedInUi);

      // Must return false to indicate persistence to localStorage was refused
      assert.strictEqual(saveResult, false, 'saveProfile() must return false when refusing to overwrite future version');

      // 4. Verify raw localStorage content before vs after: MUST BE UNTOUCHED
      const currentRawJson = mockStore['unisearch_profile'];
      assert.strictEqual(currentRawJson, initialRawJson, 'localStorage content MUST be strictly identical before and after save attempt');

      const parsedStorage = JSON.parse(mockStore['unisearch_profile']);
      assert.strictEqual(parsedStorage.budget, 75000, 'Storage must NOT have been modified by UI attempt');
      assert.strictEqual(parsedStorage._v, 3);
      assert.deepStrictEqual(parsedStorage.aiPersonalizationV3, { algorithm: 'neural_v3', weights: [0.1, 0.9] });
      assert.strictEqual(parsedStorage.exams[0].customV3Field, 'verified_score');
    });

    test('in-memory consistency: loadProfile() preserves UI edits in-memory when saveProfile() refuses localStorage overwrite for _v: 3', () => {
      // 1. Put in localStorage profile _v: 3, budget: 50000
      const futureStored = {
        _v: 3,
        budget: 50000,
        budgetCurrency: 'USD',
        futureFlag: true,
      };
      const initialJson = JSON.stringify(futureStored);
      mockStore['unisearch_profile'] = initialJson;

      // 2. Call loadProfile()
      const initial = loadProfile();
      assert.strictEqual(initial._v, 3);
      assert.strictEqual(initial.budget, 50000);

      // 3. Edit budget to 60000
      const editedDraft = { ...initial, budget: 60000 };

      // 4. Call saveProfile()
      let eventDispatched = false;
      const origDispatch = global.window.dispatchEvent;
      global.window.dispatchEvent = (event) => {
        if (event?.type === 'profileUpdated') eventDispatched = true;
      };
      const saveResult = saveProfile(editedDraft);
      global.window.dispatchEvent = origDispatch;

      assert.strictEqual(saveResult, false, 'saveProfile() must return false to indicate in-memory only');
      assert.strictEqual(eventDispatched, true, 'profileUpdated event must be dispatched');

      // 5. Immediately call loadProfile() again
      const reloadedImmediate = loadProfile();
      assert.strictEqual(reloadedImmediate.budget, 60000, 'loadProfile() must return in-memory 60000 and NOT clobber with 50000');
      assert.strictEqual(reloadedImmediate._v, 3);
      assert.strictEqual(reloadedImmediate.futureFlag, true);

      // 6. Simulate subsequent reads (e.g. from UI components listening to profileUpdated)
      const reloadedSubsequent = loadProfile();
      assert.strictEqual(reloadedSubsequent.budget, 60000, 'Subsequent UI reads must also preserve 60000 in memory');

      // 7. Verify localStorage is strictly byte-for-byte untouched!
      assert.strictEqual(mockStore['unisearch_profile'], initialJson, 'localStorage MUST remain 100% byte-for-byte identical to original');
      const parsedStorage = JSON.parse(mockStore['unisearch_profile']);
      assert.strictEqual(parsedStorage.budget, 50000, 'Underlying storage must remain 50000');
    });

    test('saveProfile() refuses to overwrite corrupted future-version JSON string in localStorage', () => {
      const corruptFutureString = 'invalid-prefix-{"_v": 3, "budget": 50000, broken-tail';
      mockStore['unisearch_profile'] = corruptFutureString;

      const loaded = loadProfile();
      assert.strictEqual(loaded._v, 2, 'loadProfile gracefully defaults when JSON parse fails');

      const saveResult = saveProfile({ budget: 10000, _v: 2 });
      assert.strictEqual(saveResult, false, 'saveProfile must refuse to overwrite corrupted string containing future version tag');
      assert.strictEqual(mockStore['unisearch_profile'], corruptFutureString, 'corrupt future storage string must be preserved');
    });

    test('saveProfile() recovers corrupted non-future storage with valid JSON upon explicit user save', () => {
      const corruptLegacyString = '{{{completely broken non-future data';
      mockStore['unisearch_profile'] = corruptLegacyString;

      const loaded = loadProfile();
      assert.ok(!('name' in loaded), 'nickname field must not exist');
      assert.strictEqual(loaded.budget, '');

      const validProfile = { _v: 2, budget: 15000, major: 'Physics' };
      const saveResult = saveProfile(validProfile);
      assert.strictEqual(saveResult, true, 'saveProfile should successfully recover non-future corrupted storage');

      const parsed = JSON.parse(mockStore['unisearch_profile']);
      assert.strictEqual(parsed._v, 2);
      assert.ok(!('name' in parsed), 'nickname field must not exist');
      assert.strictEqual(parsed.budget, 15000);
      assert.strictEqual(parsed.major, 'Physics');
    });

    test('saveProfile() normally persists version 2 profile without blocking', () => {
      // Clear or set v2 profile
      delete mockStore['unisearch_profile'];
      clearProfile();

      const v2Profile = {
        _v: 2,
        budget: 25000,
        budgetCurrency: 'USD',
        gpa: 3.8,
        gpaScale: 4,
      };

      const result = saveProfile(v2Profile);
      assert.strictEqual(result, true, 'saveProfile() must return true for version 2 profile');

      const stored = JSON.parse(mockStore['unisearch_profile']);
      assert.strictEqual(stored._v, 2);
      assert.ok(!('name' in stored), 'nickname field must not exist');
      assert.strictEqual(stored.budget, 25000);
    });
  });

  describe('Legacy profile migration on loadProfile()', () => {
    test('preserves legacy family income buckets as opaque local profile data', () => {
      const original = {
        _v: PROFILE_VERSION,
        major: 'Physics',
        familyIncome: 'under_85k',
        family_income: '85k_140k',
        family_income_bracket: 'over_200k',
      };
      mockStore['unisearch_profile'] = JSON.stringify(original);

      const loaded = loadProfile();

      assert.strictEqual(loaded.major, 'Physics');
      assert.strictEqual(loaded.familyIncome, 'under_85k');
      assert.strictEqual(loaded.family_income, '85k_140k');
      assert.strictEqual(loaded.family_income_bracket, 'over_200k');
      assert.deepStrictEqual(JSON.parse(mockStore['unisearch_profile']), original);
      const writesAfterFirstLoad = setItemCalls;
      assert.strictEqual(loadProfile().family_income_bracket, 'over_200k');
      assert.strictEqual(setItemCalls, writesAfterFirstLoad, 'Current profiles with opaque legacy buckets must not be migrated repeatedly');
      assert.strictEqual(loadProfileForApi().family_income_bracket, undefined);
      assert.strictEqual(setItemCalls, writesAfterFirstLoad, 'API projection must not trigger another profile migration write');
    });

    test('migrates full legacy profile with snake_case and camelCase legacy aliases', () => {
      const legacyStoredProfile = {
        name: 'Legacy Student',
        budget: 20000,
        // NOTE: legacy nickname in `name` must be stripped by migration.
        budget_currency: 'EUR',
        funding_type: 'grant',
        study_level: 'Master',
        family_income_bracket: 'under_85k',
        citizenships: 'KZ, US, kz',
        country_of_education: 'KZ',
        education_credential: 'other',
        education_credential_other: 'NIS Grade 12',
        applicant_route: 'first_year',
        intended_entry_cycle: '2027 Fall',
        current_residence_country: 'OTHER',
        current_residence_other: 'XK',
        fee_status_context: 'unknown',
        gpa: 4.85,
        gpa_scale: 5,
        selected_admission_choices: {
          oxford: {
            choice_key: 'ox-cs-grant',
            program_id: 'cs',
            program_name: 'Computer Science',
            category_id: 'undergrad',
            requirement_profile_id: 'req_direct',
            funding_option_id: 'fund_full',
          },
        },
        exams: [
          {
            id: 'sat',
            score: 1510,
            rawValue: '1510',
            displayValue: '1510 (Math 800)',
            details: { math: 800, reading: 710 },
          },
        ],
        languages: [
          {
            lang: 'ru',
            kind: 'native',
          },
          {
            lang: 'en',
            kind: 'exam',
            examId: 'ielts',
            score: 8.0,
            rawValue: '8.0',
            displayValue: '8.0 Overall',
            details: { listening: 8.5, reading: 8.5, writing: 7.5, speaking: 7.5 },
          },
        ],
        major: 'Informatics',
        interests: 'Distributed systems',
        studyMode: 'Campus',
      };

      mockStore['unisearch_profile'] = JSON.stringify(legacyStoredProfile);

      const loaded = loadProfile();

      // Verify canonical root fields
      assert.strictEqual(loaded._v, 2);
      assert.ok(!('name' in loaded), 'legacy nickname must be stripped');
      assert.strictEqual(loaded.budget, 20000);
      assert.strictEqual(loaded.budgetCurrency, 'EUR');
      assert.strictEqual(loaded.budget_currency, undefined);
      assert.strictEqual(loaded.fundingType, 'grant');
      assert.strictEqual(loaded.funding_type, undefined);
      assert.strictEqual(loaded.gpaScale, 5);
      assert.strictEqual(loaded.gpa_scale, undefined);
      assert.strictEqual(loaded.gpa, 4.85); // Preserved without clamping to 4.0!
      assert.strictEqual(loaded.major, 'Informatics');
      assert.strictEqual(loaded.interests, 'Distributed systems');
      assert.strictEqual(loaded.studyMode, 'Campus');
      assert.strictEqual(loaded.studyLevel, 'Master');
      assert.strictEqual(loaded.study_level, undefined);
      assert.strictEqual(loaded.family_income_bracket, 'under_85k');
      assert.strictEqual(loaded.familyIncome, undefined);
      assert.strictEqual(loadProfileForApi().family_income_bracket, undefined);
      assert.deepStrictEqual(loaded.citizenships, ['KZ', 'US']);
      assert.strictEqual(loaded.citizenship, 'KZ');
      assert.strictEqual(loaded.countryOfEducation, 'KZ');
      assert.strictEqual(loaded.educationCredentialOther, 'NIS Grade 12');
      assert.strictEqual(loaded.applicantRoute, 'first_year');
      assert.strictEqual(loaded.intendedEntryCycle, '2027 Fall');
      assert.strictEqual(loaded.currentResidenceCountry, 'OTHER');
      assert.strictEqual(loaded.currentResidenceOther, 'XK');
      assert.strictEqual(loaded.feeStatusContext, 'unknown');

      // Verify canonical selectedAdmissionChoices
      assert.strictEqual(loaded.selected_admission_choices, undefined);
      assert.ok(loaded.selectedAdmissionChoices.oxford);
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.choiceKey, 'ox-cs-grant');
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.choice_key, undefined);
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.programId, 'cs');
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.program_id, undefined);
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.programName, 'Computer Science');
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.program_name, undefined);
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.categoryId, 'undergrad');
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.category_id, undefined);
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.requirementProfileId, 'req_direct');
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.requirement_profile_id, undefined);
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.fundingOptionId, 'fund_full');
      assert.strictEqual(loaded.selectedAdmissionChoices.oxford.funding_option_id, undefined);

      // Verify canonical exams
      assert.strictEqual(loaded.exams.length, 1);
      const ex = loaded.exams[0];
      assert.strictEqual(ex.id, 'SAT');
      assert.strictEqual(ex.exam, 'SAT');
      assert.strictEqual(ex.score, 1510);
      assert.strictEqual(ex.raw_value, '1510');
      assert.strictEqual(ex.display_value, '1510 (Math 800)');
      assert.strictEqual(ex.rawValue, undefined);
      assert.strictEqual(ex.displayValue, undefined);
      assert.deepStrictEqual(ex.details, { math: 800, reading: 710 });

      // Verify canonical languages
      assert.strictEqual(loaded.languages.length, 2);
      const lang1 = loaded.languages[0];
      assert.strictEqual(lang1.code, 'ru');
      assert.strictEqual(lang1.kind, 'native');
      assert.strictEqual(lang1.lang, undefined);

      const lang2 = loaded.languages[1];
      assert.strictEqual(lang2.code, 'en');
      assert.strictEqual(lang2.kind, 'exam');
      assert.strictEqual(lang2.exam, 'ielts');
      assert.strictEqual(lang2.score, 8.0);
      assert.strictEqual(lang2.raw_value, '8.0');
      assert.strictEqual(lang2.display_value, '8.0 Overall');
      assert.strictEqual(lang2.lang, undefined);
      assert.strictEqual(lang2.examId, undefined);
      assert.strictEqual(lang2.rawValue, undefined);
      assert.strictEqual(lang2.displayValue, undefined);
      assert.deepStrictEqual(lang2.details, { listening: 8.5, reading: 8.5, writing: 7.5, speaking: 7.5 });

      // Verify migrated state was persisted back to localStorage
      const updatedStorageRaw = JSON.parse(mockStore['unisearch_profile']);
      assert.strictEqual(updatedStorageRaw._v, 2);
      assert.ok(!('name' in updatedStorageRaw), 'legacy nickname must be stripped from storage');
      assert.strictEqual(updatedStorageRaw.budgetCurrency, 'EUR');
      assert.strictEqual(updatedStorageRaw.budget_currency, undefined);
      assert.strictEqual(updatedStorageRaw.gpaScale, 5);
      assert.strictEqual(updatedStorageRaw.gpa_scale, undefined);
      assert.strictEqual(updatedStorageRaw.exams[0].raw_value, '1510');
      assert.strictEqual(updatedStorageRaw.exams[0].rawValue, undefined);
    });

    test('preserves unknown custom and future fields across root, exams, languages, and choices', () => {
      const profileWithCustomData = {
        userNotes: 'Keep this note safe',
        applicantGuid: 'guid-1234-abcd',
        budget: 35000,
        budget_currency: 'USD',
        exams: [
          {
            id: 'SAT',
            score: 1400,
            testDate: '2025-10-15',
            testCenter: 'Center 402',
            rawValue: '1400',
          },
        ],
        languages: [
          {
            code: 'en',
            kind: 'exam',
            exam: 'ielts',
            score: 7.5,
            attemptCount: 2,
            verifiedBadge: true,
          },
        ],
        selectedAdmissionChoices: {
          nus: {
            programId: 'cs',
            programName: 'Computer Science',
            categoryId: 'undergrad',
            requirementProfileId: 'req-nus',
            fundingOptionId: 'grant-nus',
            choiceKey: 'choice-nus',
            customUserRank: 1,
          },
        },
      };

      const normalized = normalizeProfileData(profileWithCustomData);

      // Root custom fields preserved, legacy nickname stripped
      assert.ok(!('name' in normalized), 'legacy nickname must be stripped');
      assert.strictEqual(normalized.userNotes, 'Keep this note safe');
      assert.strictEqual(normalized.applicantGuid, 'guid-1234-abcd');

      // Exam custom fields preserved
      assert.strictEqual(normalized.exams[0].testDate, '2025-10-15');
      assert.strictEqual(normalized.exams[0].testCenter, 'Center 402');
      assert.strictEqual(normalized.exams[0].rawValue, undefined, 'Legacy rawValue must still be stripped');

      // Language custom fields preserved
      assert.strictEqual(normalized.languages[0].attemptCount, 2);
      assert.strictEqual(normalized.languages[0].verifiedBadge, true);

      // Choice custom fields preserved
      assert.strictEqual(normalized.selectedAdmissionChoices.nus.customUserRank, 1);
    });

    test('migration is idempotent on subsequent loadProfile calls', () => {
      const legacyProfile = {
        name: 'Legacy Bob',
        budget_currency: 'KZT',
        funding_type: 'paid',
        gpa: 3.5,
        // NOTE: legacy nickname in `name` must be stripped by migration.
      };
      mockStore['unisearch_profile'] = JSON.stringify(legacyProfile);

      const callsBefore = setItemCalls;
      const loaded1 = loadProfile();
      assert.strictEqual(loaded1._v, 2);
      assert.ok(!('name' in loaded1), 'legacy nickname must be stripped');
      assert.strictEqual(setItemCalls, callsBefore + 1, 'Should have written migrated profile once');

      // Second load
      const callsAfterFirst = setItemCalls;
      const loaded2 = loadProfile();
      assert.strictEqual(setItemCalls, callsAfterFirst, 'Second load must be a no-op write (idempotent)');
      assert.deepStrictEqual(loaded1, loaded2);
    });

    test('normalizeProfileData is purely idempotent: norm(norm(p)) deepEquals norm(p)', () => {
      const mixed = {
        name: 'Test Idempotent',
        budget: '15000',
        budget_currency: 'GBP',
        gpa: '4.75',
        gpa_scale: 5,
        exams: [{ id: 'sat', score: 1400, rawValue: '1400' }],
        languages: [{ lang: 'en', kind: 'exam', examId: 'ielts', score: 7.5 }],
        selectedAdmissionChoices: {
          mit: { choice_key: 'mit-1', program_id: 'cs' },
        },
      };

      const pass1 = normalizeProfileData(mixed);
      const pass2 = normalizeProfileData(pass1);
      const pass3 = normalizeProfileData(pass2);

      assert.ok(!('name' in pass1), 'legacy nickname must be stripped');
      assert.deepStrictEqual(pass1, pass2);
      assert.deepStrictEqual(pass2, pass3);
    });
  });

  describe('Conflict resolution rules for mixed legacy/canonical fields', () => {
    test('priority rule: valid canonical gpaScale takes precedence over legacy gpa_scale', () => {
      // gpaScale=5, gpa_scale=4 -> canonical 5 wins
      const p1 = normalizeProfileData({ gpa: 4.8, gpaScale: 5, gpa_scale: 4 });
      assert.strictEqual(p1.gpaScale, 5);
      assert.strictEqual(p1.gpa, 4.8);

      // gpaScale=4, gpa_scale=5 -> canonical 4 wins
      const p2 = normalizeProfileData({ gpa: 3.8, gpaScale: 4, gpa_scale: 5 });
      assert.strictEqual(p2.gpaScale, 4);
      assert.strictEqual(p2.gpa, 3.8);

      // gpaScale is missing/invalid, gpa_scale=5 -> fallback to legacy 5
      const p3 = normalizeProfileData({ gpa: 4.9, gpaScale: undefined, gpa_scale: 5 });
      assert.strictEqual(p3.gpaScale, 5);
      assert.strictEqual(p3.gpa, 4.9);

      const p4 = normalizeProfileData({ gpa: 4.9, gpaScale: 'invalid', gpa_scale: 5 });
      assert.strictEqual(p4.gpaScale, 5);

      // Both invalid -> default to 4
      const p5 = normalizeProfileData({ gpaScale: 99, gpa_scale: 88 });
      assert.strictEqual(p5.gpaScale, 4);
    });

    test('priority rule: non-empty budgetCurrency takes precedence over legacy budget_currency', () => {
      const p1 = normalizeProfileData({ budgetCurrency: 'EUR', budget_currency: 'USD' });
      assert.strictEqual(p1.budgetCurrency, 'EUR');

      const p2 = normalizeProfileData({ budgetCurrency: '', budget_currency: 'KZT' });
      assert.strictEqual(p2.budgetCurrency, 'KZT');
    });

    test('priority rule: valid fundingType takes precedence over legacy funding_type', () => {
      const p1 = normalizeProfileData({ fundingType: 'paid', funding_type: 'grant' });
      assert.strictEqual(p1.fundingType, 'paid');

      const p2 = normalizeProfileData({ fundingType: 'invalid', funding_type: 'grant' });
      assert.strictEqual(p2.fundingType, 'grant');
    });

    test('priority rule: canonical selectedAdmissionChoices takes precedence over selected_admission_choices', () => {
      const p = normalizeProfileData({
        selectedAdmissionChoices: {
          uni1: { choiceKey: 'canon-key', programId: 'p1' },
        },
        selected_admission_choices: {
          uni1: { choice_key: 'legacy-key', program_id: 'p_legacy' },
        },
      });
      assert.strictEqual(p.selectedAdmissionChoices.uni1.choiceKey, 'canon-key');
    });

    test('priority rule: intentional empty selectedAdmissionChoices {} does NOT resurrect selected_admission_choices', () => {
      // User consciously deselected/cleared all universities -> selectedAdmissionChoices is {}
      const p = normalizeProfileData({
        selectedAdmissionChoices: {},
        selected_admission_choices: {
          'some-university': {
            choice_key: 'some-choice',
            program_id: 'p1',
          },
        },
      });

      // Must NOT resurrect the old choice; user's empty state must be respected!
      assert.deepStrictEqual(p.selectedAdmissionChoices, {}, 'Intentional empty selectedAdmissionChoices must not be overridden');
      assert.strictEqual(p.selected_admission_choices, undefined, 'Legacy alias selected_admission_choices must be stripped');
    });

    test('fallback rule: legacy selected_admission_choices migrates when canonical is absent', () => {
      const p = normalizeProfileData({
        selected_admission_choices: {
          'mit-usa-cambridge': {
            choice_key: 'cs-grant',
            program_id: 'cs',
          },
        },
      });

      assert.strictEqual(p.selectedAdmissionChoices['mit-usa-cambridge'].choiceKey, 'cs-grant');
      assert.strictEqual(p.selectedAdmissionChoices['mit-usa-cambridge'].programId, 'cs');
      assert.strictEqual(p.selected_admission_choices, undefined);
    });

    test('priority rule: legacy gpa_raw safely migrates to gpa with canonical gpa priority', () => {
      // Pure legacy gpa_raw on 5.0 scale
      const p1 = normalizeProfileData({ gpa_raw: 4.85, gpa_scale: 5 });
      assert.strictEqual(p1.gpa, 4.85);
      assert.strictEqual(p1.gpaScale, 5);
      assert.strictEqual(p1.gpa_raw, undefined, 'gpa_raw must NOT leak into canonical profile');
      assert.strictEqual(p1.gpa_scale, undefined, 'gpa_scale must NOT leak into canonical profile');

      // Legacy gpa_raw with user_gpa_scale
      const p2 = normalizeProfileData({ gpa_raw: 3.7, user_gpa_scale: 4 });
      assert.strictEqual(p2.gpa, 3.7);
      assert.strictEqual(p2.gpaScale, 4);
      assert.strictEqual(p2.gpa_raw, undefined);
      assert.strictEqual(p2.user_gpa_scale, undefined);

      // Conflict: canonical gpa and gpaScale MUST take priority over legacy gpa_raw and gpa_scale
      const p3 = normalizeProfileData({
        gpa: 3.5,
        gpaScale: 4,
        gpa_raw: 4.85,
        gpa_scale: 5,
      });
      assert.strictEqual(p3.gpa, 3.5, 'Canonical valid gpa must win over legacy gpa_raw');
      assert.strictEqual(p3.gpaScale, 4, 'Canonical gpaScale must win over legacy gpa_scale');
      assert.strictEqual(p3.gpa_raw, undefined);
      assert.strictEqual(p3.gpa_scale, undefined);

      // Canonical gpa is empty string -> safely falls back to gpa_raw
      const p4 = normalizeProfileData({
        gpa: '',
        gpa_raw: 4.85,
        gpa_scale: 5,
      });
      assert.strictEqual(p4.gpa, 4.85);
      assert.strictEqual(p4.gpaScale, 5);

      // Clamping applies to gpa_raw according to scale
      const p5 = normalizeProfileData({
        gpa_raw: 5.8,
        gpa_scale: 5,
      });
      assert.strictEqual(p5.gpa, 5.0, 'gpa_raw must be clamped to max of scale');
    });
  });

  describe('Edge cases, corrupt data, and localStorage failure resilience', () => {
    test('handles null, undefined, arrays, and primitive inputs gracefully', () => {
      const def1 = normalizeProfileData(null);
      assert.strictEqual(def1._v, 2);
      assert.ok(!('name' in def1), 'nickname field must not exist');
      assert.strictEqual(def1.gpaScale, 4);

      const def2 = normalizeProfileData(undefined);
      assert.strictEqual(def2._v, 2);

      const def3 = normalizeProfileData([]);
      assert.strictEqual(def3._v, 2);

      const def4 = normalizeProfileData('corrupted string');
      assert.strictEqual(def4._v, 2);

      const def5 = normalizeProfileData(12345);
      assert.strictEqual(def5._v, 2);
    });

    test('corrupted JSON in localStorage is NOT destroyed or overwritten by loadProfile()', () => {
      const rawCorruptedString = '{{{bad-json: broken corrupt data';
      mockStore['unisearch_profile'] = rawCorruptedString;

      const callsBefore = setItemCalls;
      let loaded;
      assert.doesNotThrow(() => {
        loaded = loadProfile();
      });
      assert.strictEqual(loaded._v, 2);
      assert.ok(!('name' in loaded), 'nickname field must not exist');

      // Crucial: loadProfile() must NOT call setItem to erase or overwrite the corrupted string!
      assert.strictEqual(setItemCalls, callsBefore, 'loadProfile() must not overwrite corrupted storage automatically');
      assert.strictEqual(mockStore['unisearch_profile'], rawCorruptedString, 'Original storage string must remain untouched');
    });

    test('safely falls back to in-memory profile when localStorage throws on write without destroying storage', () => {
      const originalLegacy = { budget: 12000, budget_currency: 'USD' };
      mockStore['unisearch_profile'] = JSON.stringify(originalLegacy);

      // Simulate browser throwing QuotaExceededError on setItem
      global.window.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      let loaded;
      assert.doesNotThrow(() => {
        loaded = loadProfile();
      });
      assert.strictEqual(loaded.budget, 12000);
      assert.strictEqual(loaded._v, 2);

      // In-memory fallback holds the normalized profile for this session
      assert.strictEqual(loadProfile().budget, 12000);

      // Original data in mockStore was not deleted
      assert.ok(mockStore['unisearch_profile'].includes('12000'));
    });
  });

  describe('GPA mathematical integrity across localStorage -> loadProfileForApi -> API', () => {
    test('exact formula verification for GPA 4.85 on 5.0 scale', () => {
      saveProfile({
        gpa: 4.85,
        gpaScale: 5,
      });

      // Stored in localStorage
      const stored = loadProfile();
      assert.strictEqual(stored.gpa, 4.85, 'GPA must be stored as 4.85 on 5.0 scale');
      assert.strictEqual(stored.gpaScale, 5);

      // Formatted for API
      const apiPayload = loadProfileForApi();
      // (4.85 / 5.0) * 4.0 = 0.97 * 4.0 = 3.88
      assert.strictEqual(apiPayload.gpa, 3.88, 'API payload gpa must be exactly 3.88');
      assert.strictEqual(apiPayload.gpa_scale, 4, 'API payload gpa_scale must be 4');
      assert.strictEqual(apiPayload.gpaScale, undefined, 'API payload must NOT contain gpaScale');
    });

    test('exact formula verification for maximum 5.0 GPA on 5.0 scale', () => {
      saveProfile({
        gpa: 5.0,
        gpaScale: 5,
      });

      const apiPayload = loadProfileForApi();
      // (5.0 / 5.0) * 4.0 = 4.0
      assert.strictEqual(apiPayload.gpa, 4.0);
      assert.strictEqual(apiPayload.gpa_scale, 4);
    });

    test('exact formula verification for GPA 3.75 on 4.0 scale', () => {
      saveProfile({
        gpa: 3.75,
        gpaScale: 4,
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.gpa, 3.75);
      assert.strictEqual(apiPayload.gpa_scale, 4);
      assert.strictEqual(apiPayload.gpaScale, undefined);
    });

    test('exact formula verification for GPA 4.0 on 4.0 scale', () => {
      saveProfile({
        gpa: 4.0,
        gpaScale: 4,
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.gpa, 4.0);
      assert.strictEqual(apiPayload.gpa_scale, 4);
    });
  });

  describe('loadProfileForApi contract verification', () => {
    test('outgoing payload contains NO legacy aliases, NO gpaScale, and NO redundant fields', () => {
      saveProfile({
        budget: 30000,
        budgetCurrency: 'USD',
        gpa: 4.8,
        gpaScale: 5,
        major: 'Computer Science',
        interests: 'Machine Learning',
        studyMode: 'Any',
        fundingType: 'grant',
        exams: [
          {
            id: 'SAT',
            exam: 'SAT',
            score: 1520,
            raw_value: '1520',
            display_value: '1520',
          },
        ],
        languages: [
          {
            code: 'en',
            kind: 'exam',
            exam: 'ielts',
            score: 7.5,
            raw_value: '7.5',
            display_value: '7.5 band',
          },
          {
            code: 'de',
            kind: 'cefr',
            level: 4,
          },
        ],
        selectedAdmissionChoices: {
          uni_1: {
            programId: 'cs',
            programName: 'Computer Science',
            categoryId: 'stem',
            requirementProfileId: 'req-1',
            fundingOptionId: 'grant-1',
            choiceKey: 'choice-123',
          },
        },
      });

      const payload = loadProfileForApi();

      // Canonical schema fields present
      assert.strictEqual(payload.budget, 30000);
      assert.strictEqual(payload.gpa, 3.84); // Converted from 4.8 (scale 5) to 4.0 scale
      assert.strictEqual(payload.gpa_scale, 4); // Sent as gpa_scale (snake_case)
      assert.strictEqual(payload.major, 'Computer Science');
      assert.strictEqual(payload.interests, 'Machine Learning');
      assert.strictEqual(payload.studyMode, 'Any');
      assert.strictEqual(payload.fundingType, 'grant');
      assert.ok(payload.locale);

      // FORBIDDEN fields: MUST NOT be present in outgoing API payload
      assert.strictEqual(payload.gpaScale, undefined, 'payload.gpaScale must NOT be present');
      assert.strictEqual(payload.gpa_raw, undefined, 'payload.gpa_raw must NOT be present');
      assert.strictEqual(payload.user_gpa_scale, undefined, 'payload.user_gpa_scale must NOT be present');
      assert.strictEqual(payload.name, undefined, 'payload.name must NOT be present');
      assert.strictEqual(payload._v, undefined, 'payload._v must NOT be present');
      assert.strictEqual(payload.version, undefined, 'payload.version must NOT be present');
      assert.strictEqual(payload.budgetCurrency, undefined, 'payload.budgetCurrency must NOT be present');
      assert.strictEqual(payload.budget_currency, undefined, 'payload.budget_currency must NOT be present');
      assert.strictEqual(payload.funding_type, undefined, 'payload.funding_type must NOT be present');
      assert.strictEqual(payload.selected_admission_choices, undefined, 'payload.selected_admission_choices must NOT be present');

      // Exam fields verification
      assert.strictEqual(payload.exams.length, 1);
      const ex = payload.exams[0];
      assert.strictEqual(ex.id, 'SAT');
      assert.strictEqual(ex.score, 1520);
      assert.strictEqual(ex.raw_value, '1520');
      assert.strictEqual(ex.display_value, '1520');
      assert.strictEqual(ex.rawValue, undefined, 'exam.rawValue must NOT be present');
      assert.strictEqual(ex.displayValue, undefined, 'exam.displayValue must NOT be present');

      // Language fields verification
      assert.strictEqual(payload.languages.length, 2);
      const langExam = payload.languages[0];
      assert.strictEqual(langExam.code, 'en');
      assert.strictEqual(langExam.kind, 'exam');
      assert.strictEqual(langExam.exam, 'ielts');
      assert.strictEqual(langExam.score, 7.5);
      assert.strictEqual(langExam.raw_value, '7.5');
      assert.strictEqual(langExam.display_value, '7.5 band');
      assert.strictEqual(langExam.lang, undefined, 'language.lang must NOT be present');
      assert.strictEqual(langExam.examId, undefined, 'language.examId must NOT be present');
      assert.strictEqual(langExam.rawValue, undefined, 'language.rawValue must NOT be present');
      assert.strictEqual(langExam.displayValue, undefined, 'language.displayValue must NOT be present');

      // Choice fields verification: strictly camelCase
      const choice = payload.selectedAdmissionChoices.uni_1;
      assert.strictEqual(choice.choiceKey, 'choice-123');
      assert.strictEqual(choice.programId, 'cs');
      assert.strictEqual(choice.programName, 'Computer Science');
      assert.strictEqual(choice.categoryId, 'stem');
      assert.strictEqual(choice.requirementProfileId, 'req-1');
      assert.strictEqual(choice.fundingOptionId, 'grant-1');
      assert.strictEqual(choice.choice_key, undefined, 'choice.choice_key must NOT be present');
      assert.strictEqual(choice.program_id, undefined, 'choice.program_id must NOT be present');
      assert.strictEqual(choice.program_name, undefined, 'choice.program_name must NOT be present');
      assert.strictEqual(choice.category_id, undefined, 'choice.category_id must NOT be present');
      assert.strictEqual(choice.requirement_profile_id, undefined, 'choice.requirement_profile_id must NOT be present');
      assert.strictEqual(choice.funding_option_id, undefined, 'choice.funding_option_id must NOT be present');
    });
  });
});
