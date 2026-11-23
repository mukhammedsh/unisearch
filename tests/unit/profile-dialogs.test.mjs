import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeDialogWithMotion,
  closeResetDialog,
  closeUnsavedDialog,
  openResetDialog,
  openUnsavedDialog,
  profileValidationFocusTarget,
} from "../../frontend/javascript/components/profile-ui.js";

function fakeModal({ native = true, open = false } = {}) {
  const classes = new Set(open ? ["is-open"] : []);
  const modal = {
    open: false,
    style: {},
    attrs: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  if (native) {
    modal.showModal = () => { modal.open = true; };
    modal.close = () => { modal.open = false; };
  }
  return modal;
}

const focusable = () => ({ focusCalls: 0, focus() { this.focusCalls += 1; } });

test("native dialogs open with showModal and close with close()", () => {
  const unsaved = fakeModal();
  const cancel = focusable();
  openUnsavedDialog({ unsavedModal: unsaved, cancelCloseBtn: cancel }, {});
  assert.equal(unsaved.open, true);
  assert.equal(unsaved.classList.contains("is-open"), true);
  assert.equal(cancel.focusCalls, 1);

  const target = focusable();
  closeDialogWithMotion(unsaved, null, target);
  assert.equal(unsaved.classList.contains("is-closing"), true, "an open dialog animates before closing");
  closeDialogWithMotion(unsaved, null, target);
  assert.equal(target.focusCalls, 0, "a dialog that is already closing ignores a repeated close request");

  const reset = fakeModal();
  const resetCancel = focusable();
  openResetDialog({ resetModal: reset, resetCancelBtn: resetCancel }, {});
  assert.equal(reset.open, true);
  assert.equal(resetCancel.focusCalls, 1);
});

test("a dialog that is not open closes at once and returns focus to the requested control", () => {
  const modal = fakeModal();
  modal.open = true;
  let cleaned = 0;
  const target = focusable();
  closeDialogWithMotion(modal, () => { cleaned += 1; }, target);
  assert.equal(modal.open, false);
  assert.equal(cleaned, 1);
  assert.equal(target.focusCalls, 1);
  closeDialogWithMotion(null, null, target);
});

test("browsers without native dialog methods fall back to display and aria-hidden", () => {
  const unsaved = fakeModal({ native: false });
  const state = {};
  const els = { unsavedModal: unsaved, cancelCloseBtn: focusable() };
  openUnsavedDialog(els, state);
  assert.equal(unsaved.style.display, "flex");
  assert.equal(unsaved.attrs["aria-hidden"], "false");
  assert.equal(typeof state.cleanupUnsavedFocusTrap, "function");

  const reset = fakeModal({ native: false });
  const resetState = {};
  openResetDialog({ resetModal: reset, resetCancelBtn: focusable() }, resetState);
  assert.equal(reset.style.display, "flex");
  assert.equal(reset.attrs["aria-hidden"], "false");
  assert.equal(typeof resetState.cleanupResetFocusTrap, "function");

  const closing = fakeModal({ native: false });
  closeDialogWithMotion(closing, null, null);
  assert.equal(closing.style.display, "none");
  assert.equal(closing.attrs["aria-hidden"], "true");
});

test("closing the unsaved dialog focuses the validation target before the close button", () => {
  const closeBtn = focusable();
  const validationTarget = focusable();
  const first = fakeModal();
  const state = { cleanupUnsavedFocusTrap: () => {} };
  closeUnsavedDialog({ unsavedModal: first, closeBtn }, state, true, validationTarget);
  assert.equal(validationTarget.focusCalls, 1);
  assert.equal(closeBtn.focusCalls, 0);
  assert.equal(state.cleanupUnsavedFocusTrap, null);

  closeUnsavedDialog({ unsavedModal: fakeModal(), closeBtn }, {}, true);
  assert.equal(closeBtn.focusCalls, 1);
  closeUnsavedDialog({ unsavedModal: null }, {});

  const resetBtn = focusable();
  closeResetDialog({ resetModal: fakeModal(), resetBtn }, {}, true);
  closeResetDialog({ resetModal: null }, {});
});

test("profile validation focus goes to the first invalid editor or field", () => {
  const original = global.document.getElementById;
  const langAdd = focusable();
  global.document.getElementById = (id) => (id === "langAddBtn" ? langAdd : null);
  try {
    const invalid = { getAttribute: (name) => (name === "aria-invalid" ? "true" : null) };
    const valid = { getAttribute: () => "false" };
    const addExamBtn = focusable();
    assert.equal(profileValidationFocusTarget({ addExamBtn }, { examEditorDirty: true }), addExamBtn);
    assert.equal(profileValidationFocusTarget({}, { examEditorDirty: true }), null);
    assert.equal(profileValidationFocusTarget({}, { languageEditorDirty: true }), langAdd);
    assert.equal(profileValidationFocusTarget({ budgetInput: invalid, gpaInput: invalid }, {}), invalid);
    assert.equal(profileValidationFocusTarget({ budgetInput: valid, gpaInput: invalid }, {}), invalid);
    assert.equal(profileValidationFocusTarget({ budgetInput: valid, gpaInput: valid }, {}), null);
  } finally {
    global.document.getElementById = original;
  }
});
