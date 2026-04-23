// setup.mjs
const mockWindow = {
  location: { protocol: 'http:', hostname: 'localhost', pathname: '/' },
  API_BASE_URL: 'http://localhost:8000',
  AI_FUNCTIONS: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
};
global.window = mockWindow;
global.document = {
  documentElement: {
    getAttribute: () => 'light',
    setAttribute: () => {},
    style: { colorScheme: 'light' },
    classList: { add: () => {}, remove: () => {} }
  },
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
  body: { appendChild: () => {} },
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
  importNode: (n) => n,
};

Object.defineProperty(global, 'navigator', {
  value: { languages: ['en-US'], language: 'en-US' },
  configurable: true,
  writable: true
});

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};
global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
};
global.CustomEvent = class {};
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
global.HTMLElement = class {};
global.HTMLImageElement = class {};
global.MutationObserver = class { observe() {} disconnect() {} };
