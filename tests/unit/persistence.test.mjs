import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  normalizeProfileData,
  loadProfile,
  loadProfileForApi,
  saveProfile,
  clearProfile,
  getSelectedAdmissionChoice,
  saveSelectedAdmissionChoice,
  saveFilters,
  loadFilters,
  calculateProfileCompletion,
} from '../../frontend/javascript/utils/persistence.js';

describe('persistence.js - Profile & Filters Storage Contracts', () => {
  let mockStore;

  beforeEach(() => {
    mockStore = {};
    const storageMock = {
      getItem: (key) => mockStore[key] ?? null,
      setItem: (key, value) => {
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

  describe('normalizeProfileData', () => {
    test('returns standard defaults for empty/null profile', () => {
      const p = normalizeProfileData(null);
      assert.ok(!('name' in p), 'nickname field must not exist');
      assert.strictEqual(p.budget, '');
      assert.strictEqual(p.familyIncomeAmount, '');
      assert.strictEqual(p.familyIncomeCurrency, 'USD');
      assert.strictEqual(p.gpa, '');
      assert.deepStrictEqual(p.exams, []);
      assert.deepStrictEqual(p.languages, []);
      assert.strictEqual(p.major, '');
      assert.strictEqual(p.interests, '');
      assert.strictEqual(p.studyMode, 'Any');
      assert.strictEqual(p.fundingType, 'any');
      assert.strictEqual(p.citizenship, '');
      assert.strictEqual(p.countryOfEducation, '');
      assert.strictEqual(p.applicantRoute, '');
      assert.strictEqual(p.feeStatusContext, 'unknown');
      assert.strictEqual(p.studyLevel, 'Any');
      assert.deepStrictEqual(p.selectedAdmissionChoices, {});
    });

    test('strips legacy nickname field instead of preserving it', () => {
      assert.ok(!('name' in normalizeProfileData({ name: '   ' })), 'whitespace nickname must be stripped');
      assert.ok(!('name' in normalizeProfileData({ name: '  Alice  ' })), 'legacy nickname must be stripped');
      assert.strictEqual(normalizeProfileData({ name: 'Alice', budget: 100 }).budget, 100);
    });

    test('normalizes fundingType strictly to grant, paid, or any', () => {
      assert.strictEqual(normalizeProfileData({ fundingType: 'GRANT' }).fundingType, 'grant');
      assert.strictEqual(normalizeProfileData({ fundingType: 'paid' }).fundingType, 'paid');
      assert.strictEqual(normalizeProfileData({ fundingType: 'scholarship' }).fundingType, 'any');
    });

    test('keeps optional family income amount and currency local and preserves legacy income buckets opaquely', () => {
      const normalized = normalizeProfileData({
        familyIncomeAmount: '85000',
        familyIncomeCurrency: 'eur',
        familyIncome: 'under_85k',
      });

      assert.strictEqual(normalized.familyIncomeAmount, 85000);
      assert.strictEqual(normalized.familyIncomeCurrency, 'EUR');
      assert.strictEqual(normalized.familyIncome, 'under_85k');
      assert.strictEqual(normalizeProfileData({ familyIncomeAmount: -1 }).familyIncomeAmount, '');
      assert.strictEqual(normalizeProfileData({ familyIncomeAmount: false }).familyIncomeAmount, '');
      assert.strictEqual(normalizeProfileData({ familyIncomeAmount: true }).familyIncomeAmount, '');
      assert.strictEqual(normalizeProfileData({ familyIncomeAmount: {} }).familyIncomeAmount, '');
      assert.strictEqual(normalizeProfileData({ familyIncomeCurrency: 'ZZZ' }).familyIncomeCurrency, 'USD');

      saveProfile(normalized);
      const loaded = loadProfile();
      assert.strictEqual(loaded.familyIncomeAmount, 85000);
      assert.strictEqual(loaded.familyIncomeCurrency, 'EUR');
      assert.strictEqual(loaded.familyIncome, 'under_85k');
      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.familyIncomeAmount, undefined);
      assert.strictEqual(apiPayload.familyIncomeCurrency, undefined);
      assert.strictEqual(apiPayload.familyIncome, undefined);
    });

    test('truncates interests to 1200 characters', () => {
      const longText = 'a'.repeat(1500);
      const normalized = normalizeProfileData({ interests: longText });
      assert.strictEqual(normalized.interests.length, 1200);
    });

    test('deduplicates exams and retains the highest score', () => {
      const profile = normalizeProfileData({
        exams: [
          { id: 'sat', score: 1400 },
          { id: 'SAT', score: 1520 },
          { id: 'sat', score: 1350 },
        ],
      });
      assert.strictEqual(profile.exams.length, 1);
      assert.strictEqual(profile.exams[0].score, 1520);
      assert.strictEqual(profile.exams[0].id, 'SAT');
    });

    test('extracts GPA from exams list if gpa field is empty', () => {
      const profile = normalizeProfileData({
        gpa: '',
        exams: [{ id: 'GPA', score: 3.8 }],
      });
      assert.strictEqual(profile.gpa, 3.8);
      // GPA exam is consumed into profile.gpa and removed from exams array
      assert.strictEqual(profile.exams.length, 0);
    });

    test('normalizes gpaScale to 4 or 5 and clamps gpa accordingly', () => {
      const p4 = normalizeProfileData({ gpa: 4.5, gpaScale: 4 });
      assert.strictEqual(p4.gpaScale, 4);
      assert.strictEqual(p4.gpa, 4); // clamped to 4

      const p5 = normalizeProfileData({ gpa: 4.85, gpaScale: 5 });
      assert.strictEqual(p5.gpaScale, 5);
      assert.strictEqual(p5.gpa, 4.85);

      const pDefault = normalizeProfileData({ gpaScale: 999 });
      assert.strictEqual(pDefault.gpaScale, 4);
    });

    test('accepts comma decimal separator in GPA and keeps two decimals', () => {
      const comma4 = normalizeProfileData({ gpa: '3,80', gpaScale: 4 });
      assert.strictEqual(comma4.gpa, 3.8);

      const comma5 = normalizeProfileData({ gpa: '4,58', gpaScale: 5 });
      assert.strictEqual(comma5.gpa, 4.58);

      const dot5 = normalizeProfileData({ gpa: '4.58', gpaScale: 5 });
      assert.strictEqual(dot5.gpa, 4.58);
    });

    test('normalizes languages: handles native, cefr, and exam correctly', () => {
      const profile = normalizeProfileData({
        languages: [
          { code: 'en', kind: 'native' },
          { code: 'de', kind: 'cefr', level: 4 }, // B2
          { code: 'fr', kind: 'cefr', level: 9 }, // Invalid level > 6, filtered out
          { code: 'en', kind: 'exam', exam: 'ielts', score: 7.5 },
          { code: '', kind: 'native' }, // Invalid, no code
        ],
      });
      assert.strictEqual(profile.languages.length, 3);
      assert.deepStrictEqual(profile.languages[0], { code: 'en', kind: 'native' });
      assert.deepStrictEqual(profile.languages[1], { code: 'de', kind: 'cefr', level: 4 });
      assert.strictEqual(profile.languages[2].code, 'en');
      assert.strictEqual(profile.languages[2].kind, 'exam');
      assert.strictEqual(profile.languages[2].score, 7.5);
    });

    test('normalizes selectedAdmissionChoices', () => {
      const profile = normalizeProfileData({
        selectedAdmissionChoices: {
          'harvard': {
            choiceKey: 'cs-grant-choice',
            programId: 'cs',
            programName: 'Computer Science',
            fundingOptionId: 'need-based',
          },
          'invalid-empty': {
            choiceKey: '',
          },
        },
      });
      assert.strictEqual(Object.keys(profile.selectedAdmissionChoices).length, 1);
      assert.strictEqual(profile.selectedAdmissionChoices.harvard.choiceKey, 'cs-grant-choice');
      assert.strictEqual(profile.selectedAdmissionChoices.harvard.programName, 'Computer Science');
    });
  });

  describe('loadProfile and saveProfile', () => {
    test('saves profile to localStorage and loads it back accurately', () => {
      const persisted = saveProfile({
        budget: 45000,
        fundingType: 'grant',
        major: 'Economics',
      });

      assert.strictEqual(persisted, true);
      const loaded = loadProfile();
      assert.ok(!('name' in loaded), 'nickname field must not exist');
      assert.strictEqual(loaded.budget, 45000);
      assert.strictEqual(loaded.fundingType, 'grant');
      assert.strictEqual(loaded.major, 'Economics');
    });

    test('reports in-memory fallback when localStorage cannot persist the profile', () => {
      global.window.localStorage.setItem = () => {
        throw new Error('storage unavailable');
      };

      const persisted = saveProfile({ budget: 12000, major: 'Physics' });

      assert.strictEqual(persisted, false);
      assert.strictEqual(loadProfile().budget, 12000);
      assert.strictEqual(loadProfile().major, 'Physics');
    });

    test('clearProfile removes profile from storage', () => {
      saveProfile({ budget: 5000, major: 'Economics' });
      clearProfile();
      const loaded = loadProfile();
      assert.ok(!('name' in loaded), 'nickname field must not exist');
      assert.strictEqual(loaded.budget, '');
    });
  });

  describe('loadProfileForApi', () => {
    test('formats profile payload ready for backend API', () => {
      saveProfile({
        budget: 50000,
        gpa: 3.8,
        gpaScale: 4,
        major: 'Physics',
        interests: 'Quantum computing',
        fundingType: 'grant',
        exams: [{ id: 'sat', score: 1550 }],
        languages: [{ code: 'en', kind: 'native' }],
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.name, undefined);
      assert.strictEqual(apiPayload.budget, 50000);
      assert.strictEqual(apiPayload.gpa, 3.8);
      assert.strictEqual(apiPayload.gpa_scale, 4);
      assert.strictEqual(apiPayload.gpaScale, undefined);
      assert.strictEqual(apiPayload.gpa_raw, undefined);
      assert.strictEqual(apiPayload.user_gpa_scale, undefined);
      assert.strictEqual(apiPayload.major, 'Physics');
      assert.strictEqual(apiPayload.interests, 'Quantum computing');
      assert.strictEqual(apiPayload.fundingType, 'grant');
      assert.strictEqual(apiPayload.exams.length, 1);
      assert.strictEqual(apiPayload.exams[0].id, 'SAT');
      assert.strictEqual(apiPayload.exams[0].score, 1550);
      assert.strictEqual(apiPayload.languages.length, 1);
      assert.ok(apiPayload.locale, 'apiPayload should include locale');
    });

    test('normalizes 5.0 scale GPA to 4.0 for API payload', () => {
      saveProfile({
        gpa: 4.8,
        gpaScale: 5,
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.gpa, 3.84);
      assert.strictEqual(apiPayload.gpa_scale, 4);
    });

    test('strips empty optional fields in loadProfileForApi', () => {
      saveProfile({
        budget: 'invalid_budget',
        major: '',
        interests: '',
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.name, undefined);
      assert.strictEqual(apiPayload.budget, undefined);
      assert.strictEqual(apiPayload.major, undefined);
      assert.strictEqual(apiPayload.interests, undefined);
      assert.strictEqual(apiPayload.citizenship, undefined);
      assert.strictEqual(apiPayload.study_level, undefined);
    });

    test('includes citizenship and study_level in API payload when configured', () => {
      saveProfile({
        citizenship: 'KZ',
        studyLevel: 'Master',
      });
      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.citizenship, 'KZ');
      assert.deepStrictEqual(apiPayload.citizenships, ['KZ']);
      assert.strictEqual(apiPayload.study_level, 'Master');
    });

    test('preserves optional applicant context and maps it to the API contract', () => {
      const context = {
        countryOfEducation: 'KZ',
        educationCredential: 'other',
        educationCredentialOther: 'NIS Grade 12 certificate',
        applicantRoute: 'first_year',
        intendedEntryCycle: '2027 Fall',
        currentResidenceCountry: 'US',
        feeStatusContext: 'self_reported_international_overseas',
      };
      saveProfile(context);

      assert.deepStrictEqual(
        Object.fromEntries(Object.keys(context).map((key) => [key, loadProfile()[key]])),
        context,
      );
      assert.deepStrictEqual(
        Object.fromEntries(Object.keys(context).map((key) => [
          key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`),
          loadProfileForApi()[key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`)],
        ])),
        {
          country_of_education: 'KZ',
          education_credential: 'other',
          education_credential_other: 'NIS Grade 12 certificate',
          applicant_route: 'first_year',
          intended_entry_cycle: '2027 Fall',
          current_residence_country: 'US',
          fee_status_context: 'self_reported_international_overseas',
        },
      );
    });

    test('keeps fee context unconfirmed by default and accepts Other country labels', () => {
      saveProfile({ countryOfEducation: 'OTHER', countryOfEducationOther: 'Kosovo' });
      const profile = loadProfile();
      const payload = loadProfileForApi();
      assert.strictEqual(profile.feeStatusContext, 'unknown');
      assert.strictEqual(payload.fee_status_context, 'unknown');
      assert.strictEqual(payload.country_of_education, 'OTHER');
      assert.strictEqual(payload.country_of_education_other, 'Kosovo');
    });

    test('bridges each supported study level to the API', () => {
      const levels = ['Any', 'Bachelor', 'Master', 'Doctorate', 'MBA'];
      for (const studyLevel of levels) {
        saveProfile({ studyLevel });
        const payload = loadProfileForApi();
        assert.strictEqual(loadProfile().studyLevel, studyLevel);
        assert.strictEqual(payload.study_level, studyLevel === 'Any' ? undefined : studyLevel);
      }
    });

    test('normalizes legacy citizenship values and drops non-string entries', () => {
      const normalized = normalizeProfileData({
        citizenship: 'gb',
        citizenships: ['KZ', ' us ', 'kz', '', null, 42, {}],
      });

      assert.deepStrictEqual(normalized.citizenships, ['KZ', 'us']);
      assert.strictEqual(normalized.citizenship, 'KZ');
      saveProfile(normalized);
      const payload = loadProfileForApi();
      assert.strictEqual(payload.citizenship, 'KZ');
      assert.deepStrictEqual(payload.citizenships, ['KZ', 'us']);
    });

    test('caps legacy citizenship lists at the backend limit', () => {
      const citizenships = ['US', 'CA', 'GB', 'KZ', 'RU', 'CN', 'IN', 'JP', 'FR', 'DE', 'BR'];
      const profile = normalizeProfileData({ citizenships });
      assert.deepStrictEqual(profile.citizenships, citizenships.slice(0, 10));
      saveProfile({ citizenships });
      assert.deepStrictEqual(loadProfileForApi().citizenships, citizenships.slice(0, 10));
    });

    test('normalizes multiple citizenships array and syncs primary', () => {
      saveProfile({
        citizenships: ['KZ', 'US', 'kz'],
      });
      const profile = loadProfile();
      assert.deepStrictEqual(profile.citizenships, ['KZ', 'US']);
      assert.strictEqual(profile.citizenship, 'KZ');

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.citizenship, 'KZ');
      assert.deepStrictEqual(apiPayload.citizenships, ['KZ', 'US']);
    });

    test('normalizes comma-separated string to citizenships array', () => {
      saveProfile({
        citizenships: 'KZ, GB, US',
      });
      const profile = loadProfile();
      assert.deepStrictEqual(profile.citizenships, ['KZ', 'GB', 'US']);
      assert.strictEqual(profile.citizenship, 'KZ');
    });

    test('converts profile budget from budgetCurrency to USD for API payload', () => {
      saveProfile({
        budget: 10000000,
        budgetCurrency: 'KZT',
      });

      const apiPayload = loadProfileForApi();
      // KZT rate is ~500 KZT per USD, so 10,000,000 KZT -> ~20,000 USD
      assert.ok(apiPayload.budget > 15000 && apiPayload.budget < 25000, `Expected budget around 20,000 USD, got ${apiPayload.budget}`);
    });

    test('clamps converted budget to [0, 1000000] in loadProfileForApi', () => {
      saveProfile({
        budget: 999999999999,
        budgetCurrency: 'EUR',
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.budget, 1000000);
    });
  });

  describe('saveSelectedAdmissionChoice & getSelectedAdmissionChoice', () => {
    test('saves and retrieves choice for specific university', () => {
      let profileUpdatedEvents = 0;
      const originalDispatch = global.window.dispatchEvent;
      global.window.dispatchEvent = (event) => {
        if (event?.type === 'profileUpdated') profileUpdatedEvents += 1;
        return originalDispatch.call(global.window, event);
      };
      saveSelectedAdmissionChoice('oxford', {
        choiceKey: 'oxford-choice-1',
        programId: 'eng-sci',
      });

      const choiceKey = getSelectedAdmissionChoice('oxford');
      assert.strictEqual(choiceKey, 'oxford-choice-1');
      assert.strictEqual(loadProfileForApi().selectedAdmissionChoices.oxford.choiceKey, 'oxford-choice-1');
      assert.strictEqual(profileUpdatedEvents, 1);

      // Removing choice when selection is null
      saveSelectedAdmissionChoice('oxford', null);
      assert.strictEqual(getSelectedAdmissionChoice('oxford'), '');
      assert.strictEqual(profileUpdatedEvents, 2);
      global.window.dispatchEvent = originalDispatch;
    });
  });

  describe('loadFilters and saveFilters', () => {
    test('saves filters and loads them correctly', () => {
      const filters = {
        q: 'Technology',
        country: 'USA',
        region: 'Massachusetts',
        city: 'Cambridge',
        min_tuition: 10000,
        max_tuition: 60000,
        sort: 'uni_ai',
        only_saved: true,
        viewMode: 'list',
      };

      saveFilters(filters);
      const loaded = loadFilters();
      assert.strictEqual(loaded.q, 'Technology');
      assert.strictEqual(loaded.country, 'USA');
      assert.strictEqual(loaded.region, 'Massachusetts');
      assert.strictEqual(loaded.city, 'Cambridge');
      assert.strictEqual(loaded.min_tuition, 10000);
      assert.strictEqual(loaded.max_tuition, 60000);
      assert.strictEqual(loaded.sort, 'uni_ai');
      assert.strictEqual(loaded.only_saved, true);
    });
  });

  describe('calculateProfileCompletion', () => {
    test('returns 0 completed when profile is empty or null', () => {
      const res = calculateProfileCompletion(null);
      assert.strictEqual(res.completed, 0);
      assert.strictEqual(res.total, 7);
      assert.strictEqual(res.percentage, 0);
      assert.deepStrictEqual(res.details, {
        budget: false,
        studyMode: false,
        fundingType: false,
        gpa: false,
        exams: false,
        languages: false,
        major: false,
      });
    });

    test('counts studyMode and fundingType for default normalized profile (2/7)', () => {
      const defaultProfile = normalizeProfileData(null);
      const res = calculateProfileCompletion(defaultProfile);
      assert.strictEqual(res.completed, 2);
      assert.strictEqual(res.total, 7);
      assert.strictEqual(res.percentage, 29);
      assert.strictEqual(res.details.studyMode, true);
      assert.strictEqual(res.details.fundingType, true);
      assert.strictEqual(res.details.budget, false);
      assert.strictEqual(res.details.gpa, false);
      assert.strictEqual(res.details.exams, false);
      assert.strictEqual(res.details.languages, false);
      assert.strictEqual(res.details.major, false);
    });

    test('budget completion recognizes strings, numbers, and zero, but not empty/whitespace', () => {
      assert.strictEqual(calculateProfileCompletion({ budget: '25000' }).details.budget, true);
      assert.strictEqual(calculateProfileCompletion({ budget: 25000 }).details.budget, true);
      assert.strictEqual(calculateProfileCompletion({ budget: '0' }).details.budget, true);
      assert.strictEqual(calculateProfileCompletion({ budget: 0 }).details.budget, true);
      assert.strictEqual(calculateProfileCompletion({ budget: '' }).details.budget, false);
      assert.strictEqual(calculateProfileCompletion({ budget: '   ' }).details.budget, false);
      assert.strictEqual(calculateProfileCompletion({ budget: null }).details.budget, false);
    });

    test('studyMode completion recognizes any selected mode', () => {
      assert.strictEqual(calculateProfileCompletion({ studyMode: 'Any' }).details.studyMode, true);
      assert.strictEqual(calculateProfileCompletion({ studyMode: 'On-campus' }).details.studyMode, true);
      assert.strictEqual(calculateProfileCompletion({ studyMode: 'Online' }).details.studyMode, true);
      assert.strictEqual(calculateProfileCompletion({ study_mode: 'On-campus' }).details.studyMode, true);
      assert.strictEqual(calculateProfileCompletion({ studyMode: '' }).details.studyMode, false);
      assert.strictEqual(calculateProfileCompletion({ studyMode: '   ' }).details.studyMode, false);
    });

    test('fundingType completion recognizes any selected funding type', () => {
      assert.strictEqual(calculateProfileCompletion({ fundingType: 'any' }).details.fundingType, true);
      assert.strictEqual(calculateProfileCompletion({ fundingType: 'grant' }).details.fundingType, true);
      assert.strictEqual(calculateProfileCompletion({ fundingType: 'paid' }).details.fundingType, true);
      assert.strictEqual(calculateProfileCompletion({ funding_type: 'grant' }).details.fundingType, true);
      assert.strictEqual(calculateProfileCompletion({ fundingType: '' }).details.fundingType, false);
    });

    test('GPA completion recognizes non-empty values independently from exams', () => {
      assert.strictEqual(calculateProfileCompletion({ gpa: '3.8' }).details.gpa, true);
      assert.strictEqual(calculateProfileCompletion({ gpa: 3.8 }).details.gpa, true);
      assert.strictEqual(calculateProfileCompletion({ gpa: '' }).details.gpa, false);
      assert.strictEqual(calculateProfileCompletion({ gpa: '  ' }).details.gpa, false);
    });

    test('exams completion requires at least one valid exam', () => {
      assert.strictEqual(calculateProfileCompletion({ exams: [] }).details.exams, false);
      assert.strictEqual(calculateProfileCompletion({ exams: [{ exam: 'IELTS', score: 7.5 }] }).details.exams, true);
      assert.strictEqual(calculateProfileCompletion({ exams: [{ id: 'SAT', score: 1450 }] }).details.exams, true);
      assert.strictEqual(calculateProfileCompletion({ exams: [{}] }).details.exams, false);
    });

    test('languages completion requires at least one valid language', () => {
      assert.strictEqual(calculateProfileCompletion({ languages: [] }).details.languages, false);
      assert.strictEqual(calculateProfileCompletion({ languages: [{ code: 'en', kind: 'native' }] }).details.languages, true);
      assert.strictEqual(calculateProfileCompletion({ languages: [{ lang: 'kz', kind: 'native' }] }).details.languages, true);
      assert.strictEqual(calculateProfileCompletion({ languages: [{}] }).details.languages, false);
    });

    test('major completion recognizes non-empty selected major', () => {
      assert.strictEqual(calculateProfileCompletion({ major: 'Computer Science' }).details.major, true);
      assert.strictEqual(calculateProfileCompletion({ major: '' }).details.major, false);
      assert.strictEqual(calculateProfileCompletion({ major: '   ' }).details.major, false);
    });

    test('interests do not contribute to profile completion calculation', () => {
      const withoutInterests = calculateProfileCompletion({
        budget: '20000',
        studyMode: 'Any',
        fundingType: 'any',
        gpa: '3.8',
        exams: [{ exam: 'SAT', score: 1400 }],
        languages: [{ code: 'en', kind: 'native' }],
        major: '',
      });
      const withInterests = calculateProfileCompletion({
        budget: '20000',
        studyMode: 'Any',
        fundingType: 'any',
        gpa: '3.8',
        exams: [{ exam: 'SAT', score: 1400 }],
        languages: [{ code: 'en', kind: 'native' }],
        major: '',
        interests: 'artificial intelligence, robotics, gamedev',
      });
      assert.strictEqual(withoutInterests.completed, 6);
      assert.strictEqual(withInterests.completed, 6);
      assert.strictEqual(withInterests.percentage, 86);
      assert.strictEqual(withInterests.percentage, withoutInterests.percentage);
    });

    test('profile reaches 100% (7/7) strictly when all 7 criteria are fulfilled', () => {
      const fullProfile = {
        budget: '20000',
        studyMode: 'On-campus',
        fundingType: 'grant',
        gpa: '3.9',
        exams: [{ exam: 'SAT', score: 1520 }],
        languages: [{ code: 'en', kind: 'native' }],
        major: 'Computer Science',
      };
      const res = calculateProfileCompletion(fullProfile);
      assert.strictEqual(res.completed, 7);
      assert.strictEqual(res.total, 7);
      assert.strictEqual(res.percentage, 100);
      assert.strictEqual(Object.values(res.details).every(Boolean), true);
    });

    test('does not give 100% if exams are missing even if GPA is present', () => {
      const withoutExams = {
        budget: '20000',
        studyMode: 'On-campus',
        fundingType: 'grant',
        gpa: '3.9',
        exams: [],
        languages: [{ code: 'en', kind: 'native' }],
        major: 'Computer Science',
      };
      const res = calculateProfileCompletion(withoutExams);
      assert.strictEqual(res.completed, 6);
      assert.strictEqual(res.percentage, 86);
      assert.strictEqual(res.details.exams, false);
      assert.strictEqual(res.details.gpa, true);
    });

    test('does not give 100% if GPA is missing even if exams are present', () => {
      const withoutGpa = {
        budget: '20000',
        studyMode: 'On-campus',
        fundingType: 'grant',
        gpa: '',
        exams: [{ exam: 'SAT', score: 1500 }],
        languages: [{ code: 'en', kind: 'native' }],
        major: 'Computer Science',
      };
      const res = calculateProfileCompletion(withoutGpa);
      assert.strictEqual(res.completed, 6);
      assert.strictEqual(res.percentage, 86);
      assert.strictEqual(res.details.gpa, false);
      assert.strictEqual(res.details.exams, true);
    });
  });
});
