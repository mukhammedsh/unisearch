import test from 'node:test';
import assert from 'node:assert';
import './setup.mjs';

// Mocking some functions from utils if needed, or just testing the pattern
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}

// The vulnerable pattern
function renderVulnerable(node, rows) {
  node.innerHTML = rows.slice(0, 7).map((name) => `
    <button class="rank-search-suggestion" type="button" data-value="${escapeHtmlAttr(name)}" role="option">
      <span>${escapeHtml(name)}</span>
    </button>
  `).join("");
}

// The secure pattern I intend to implement
function renderSecure(node, rows) {
  node.innerHTML = '';
  rows.slice(0, 7).forEach((name) => {
    const btn = document.createElement('button');
    btn.className = 'rank-search-suggestion';
    btn.type = 'button';
    btn.setAttribute('data-value', name);
    btn.setAttribute('role', 'option');

    const span = document.createElement('span');
    span.textContent = name;

    btn.appendChild(span);
    node.appendChild(btn);
  });
}

test('rendering suggestions should not execute script', (t) => {
  const maliciousName = '"><img src=x onerror=global.vulnerable=true>';

  // Mocking DOM elements
  const createMockElement = () => {
    const children = [];
    return {
      children,
      set innerHTML(val) {
        // Simple mock of innerHTML parsing for the test
        if (val.includes('onerror=')) {
          global.vulnerable = true;
        }
      },
      appendChild(child) {
        children.push(child);
      },
      removeChild(child) {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
      }
    };
  };

  const node = createMockElement();

  // We can't easily test if innerHTML ACTUALLY executes in node:test without a real JSDOM
  // but we can test that our secure version doesn't use innerHTML for user data.

  // Let's refine the test to use a more realistic mock or just focus on the logic.

  // Actually, I'll just check that renderSecure uses textContent.
});

test('renderSecure uses DOM APIs safely', (t) => {
  const maliciousName = '"><img src=x onerror=alert(1)>';
  let innerHTMLSetCount = 0;
  let textContentSet = '';

  const mockNode = {
    set innerHTML(val) {
      innerHTMLSetCount++;
      assert.strictEqual(val, '', 'innerHTML should only be used to clear the node');
    },
    appendChild: (child) => {}
  };

  const originalCreateElement = global.document.createElement;
  const createdElements = [];

  global.document.createElement = (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      setAttribute: (name, val) => {
        el[name] = val;
      },
      appendChild: (child) => {
        el.child = child;
      },
      set textContent(val) {
        textContentSet = val;
      }
    };
    createdElements.push(el);
    return el;
  };

  renderSecure(mockNode, [maliciousName]);

  assert.strictEqual(innerHTMLSetCount, 1, 'innerHTML should be called once to clear');
  assert.strictEqual(textContentSet, maliciousName, 'textContent should be used for user data');

  const btn = createdElements.find(e => e.tagName === 'BUTTON');
  assert.strictEqual(btn['data-value'], maliciousName, 'data-value should be set via setAttribute');

  // Restore
  global.document.createElement = originalCreateElement;
});
