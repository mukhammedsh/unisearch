import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  safeLocalStorage,
  safeSessionStorage,
  createSafeStorage
} from '../../frontend/javascript/utils/safe-storage.js';

describe('safe-storage.js', () => {
  let mockLocalStorage;
  let mockSessionStorage;

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};

    const localStorageMock = {
      getItem: (key) => mockLocalStorage[key] ?? null,
      setItem: (key, value) => {
        mockLocalStorage[key] = String(value);
      },
      removeItem: (key) => {
        delete mockLocalStorage[key];
      },
    };

    const sessionStorageMock = {
      getItem: (key) => mockSessionStorage[key] ?? null,
      setItem: (key, value) => {
        mockSessionStorage[key] = String(value);
      },
      removeItem: (key) => {
        delete mockSessionStorage[key];
      },
    };

    // Attach to both global and window
    global.localStorage = localStorageMock;
    global.sessionStorage = sessionStorageMock;
    global.window.localStorage = localStorageMock;
    global.window.sessionStorage = sessionStorageMock;
  });

  describe('Basic operations', () => {
    test('safeLocalStorage sets and gets items', () => {
      const result = safeLocalStorage.set('testKey', 'testValue');
      assert.strictEqual(result, true, 'set should return true');
      assert.strictEqual(safeLocalStorage.get('testKey'), 'testValue');
      assert.strictEqual(mockLocalStorage['testKey'], 'testValue');
    });

    test('safeSessionStorage sets and gets items', () => {
      const result = safeSessionStorage.set('testKey', 'sessionValue');
      assert.strictEqual(result, true, 'set should return true');
      assert.strictEqual(safeSessionStorage.get('testKey'), 'sessionValue');
      assert.strictEqual(mockSessionStorage['testKey'], 'sessionValue');
    });

    test('remove deletes items from storage', () => {
      safeLocalStorage.set('testKey', 'testValue');
      const result = safeLocalStorage.remove('testKey');
      assert.strictEqual(result, true, 'remove should return true');
      assert.strictEqual(safeLocalStorage.get('testKey'), '');
      assert.strictEqual(mockLocalStorage['testKey'], undefined);
    });
  });

  describe('JSON operations', () => {
    test('setJson and getJson handle objects', () => {
      const data = { a: 1, b: [2, 3] };
      safeLocalStorage.setJson('jsonKey', data);
      assert.deepStrictEqual(safeLocalStorage.getJson('jsonKey'), data);
      assert.strictEqual(mockLocalStorage['jsonKey'], JSON.stringify(data));
    });

    test('getJson returns fallback for missing key', () => {
      const fallback = { default: true };
      assert.deepStrictEqual(safeLocalStorage.getJson('missing', fallback), fallback);
    });

    test('getJson returns fallback for invalid JSON', () => {
      mockLocalStorage['badJson'] = '{ invalid';
      const fallback = { error: true };
      assert.deepStrictEqual(safeLocalStorage.getJson('badJson', fallback), fallback);
    });
  });

  describe('Fallback and Edge Cases', () => {
    test('get returns fallback for missing key', () => {
      assert.strictEqual(safeLocalStorage.get('nonexistent', 'default'), 'default');
    });

    test('createSafeStorage works with custom stores', () => {
        // In the implementation, storageApi only handles "session" vs anything else (defaulting to localStorage)
        const customStorage = createSafeStorage('session');
        customStorage.set('key', 'val');
        assert.strictEqual(mockSessionStorage['key'], 'val');
    });
  });

  describe('Error Handling', () => {
    test('get handles storage errors gracefully', () => {
      global.window.localStorage.getItem = () => { throw new Error('storage error'); };
      assert.strictEqual(safeLocalStorage.get('any', 'fallback'), 'fallback');
    });

    test('set handles storage errors gracefully', () => {
      global.window.localStorage.setItem = () => { throw new Error('storage error'); };
      assert.strictEqual(safeLocalStorage.set('any', 'value'), false);
    });

    test('remove handles storage errors gracefully', () => {
      global.window.localStorage.removeItem = () => { throw new Error('storage error'); };
      assert.strictEqual(safeLocalStorage.remove('any'), false);
    });

    test('setJson handles serialization/storage errors gracefully', () => {
        global.window.localStorage.setItem = () => { throw new Error('storage error'); };
        assert.strictEqual(safeLocalStorage.setJson('any', { a: 1 }), false);
    });
  });
});
