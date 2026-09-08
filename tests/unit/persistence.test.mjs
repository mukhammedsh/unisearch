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
      assert.strictEqual(p.name, 'User');
      assert.strictEqual(p.budget, '');
      assert.strictEqual(p.gpa, '');
      assert.deepStrictEqual(p.exams, []);
      assert.deepStrictEqual(p.languages, []);
      assert.strictEqual(p.major, '');
      assert.strictEqual(p.interests, '');
      assert.strictEqual(p.studyMode, 'Any');
      assert.strictEqual(p.fundingType, 'any');
      assert.deepStrictEqual(p.selectedAdmissionChoices, {});
    });

    test('trims name and falls back to User if name is only whitespace', () => {
      assert.strictEqual(normalizeProfileData({ name: '   ' }).name, 'User');
      assert.strictEqual(normalizeProfileData({ name: '  Alice  ' }).name, 'Alice');
    });

    test('normalizes fundingType strictly to grant, paid, or any', () => {
      assert.strictEqual(normalizeProfileData({ fundingType: 'GRANT' }).fundingType, 'grant');
      assert.strictEqual(normalizeProfileData({ fundingType: 'paid' }).fundingType, 'paid');
      assert.strictEqual(normalizeProfileData({ fundingType: 'scholarship' }).fundingType, 'any');
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
      saveProfile({
        name: 'John Doe',
        budget: 45000,
        fundingType: 'grant',
        major: 'Economics',
      });

      const loaded = loadProfile();
      assert.strictEqual(loaded.name, 'John Doe');
      assert.strictEqual(loaded.budget, 45000);
      assert.strictEqual(loaded.fundingType, 'grant');
      assert.strictEqual(loaded.major, 'Economics');
    });

    test('clearProfile removes profile from storage', () => {
      saveProfile({ name: 'Bob' });
      clearProfile();
      const loaded = loadProfile();
      assert.strictEqual(loaded.name, 'User');
    });
  });

  describe('loadProfileForApi', () => {
    test('formats profile payload ready for backend API', () => {
      saveProfile({
        name: 'Alice',
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
      assert.strictEqual(apiPayload.name, 'Alice');
      assert.strictEqual(apiPayload.budget, 50000);
      assert.strictEqual(apiPayload.gpa, 3.8);
      assert.strictEqual(apiPayload.gpa_scale, 4);
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
        name: 'Bob',
        gpa: 4.8,
        gpaScale: 5,
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.gpa, 3.84);
      assert.strictEqual(apiPayload.gpa_scale, 4);
    });

    test('strips empty optional fields in loadProfileForApi', () => {
      saveProfile({
        name: '',
        budget: 'invalid_budget',
        major: '',
        interests: '',
      });

      const apiPayload = loadProfileForApi();
      assert.strictEqual(apiPayload.name, 'User');
      assert.strictEqual(apiPayload.budget, undefined);
      assert.strictEqual(apiPayload.major, undefined);
      assert.strictEqual(apiPayload.interests, undefined);
    });
  });

  describe('saveSelectedAdmissionChoice & getSelectedAdmissionChoice', () => {
    test('saves and retrieves choice for specific university', () => {
      saveSelectedAdmissionChoice('oxford', {
        choiceKey: 'oxford-choice-1',
        programId: 'eng-sci',
      });

      const choiceKey = getSelectedAdmissionChoice('oxford');
      assert.strictEqual(choiceKey, 'oxford-choice-1');

      // Removing choice when selection is null
      saveSelectedAdmissionChoice('oxford', null);
      assert.strictEqual(getSelectedAdmissionChoice('oxford'), '');
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
});
