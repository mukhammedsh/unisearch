/**
 * Closes a modal dialog when a press starts and ends outside its box, for browsers that do not
 * yet support `closedby="any"`. Browsers with native support handle it from the attribute.
 * @param {HTMLDialogElement} dialog
 */
export function enableDialogLightDismissFallback(dialog) {
  if ("closedBy" in HTMLDialogElement.prototype) return;
  const outsideDialog = (event) => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => { pressedOutside = outsideDialog(event); });
  dialog.addEventListener("pointerup", (event) => {
    if (pressedOutside && outsideDialog(event)) dialog.close();
    pressedOutside = false;
  });
}
