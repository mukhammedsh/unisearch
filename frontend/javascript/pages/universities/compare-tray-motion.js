// Compare tray motion: the tray enters and leaves once, and inside it only the chip that changed moves
// (stage 2 of docs/superpowers/specs/2026-11-25-motion-system-design.md).
import { animateElementOut, markMotionEnter, prefersReducedMotion, replayMotion } from "../../utils.js";

const CHIP_SELECTOR = ".compare-tray__chip";

/**
 * @param {string} id
 * @returns {string}
 */
function chipSelector(id) {
  return `${CHIP_SELECTOR}[data-uni-id="${CSS.escape(id)}"]`;
}

/**
 * @param {HTMLElement} tray
 * @returns {{
 *   deferForRemovedChips: (nextIds: string[], rerender: () => void) => boolean,
 *   show: (nextIds: string[], renderContent: () => void) => void,
 *   hide: () => void,
 * }}
 */
export function createCompareTrayMotion(tray) {
  /** @type {string[]} */
  let shownIds = [];
  let exitToken = 0;

  return {
    /**
     * Fades out chips whose universities left the selection while the tray stays open.
     * Returns true when the caller must re-render later (through `rerender`) instead of now.
     */
    deferForRemovedChips(nextIds, rerender) {
      if (tray.hidden || !nextIds.length || prefersReducedMotion()) return false;
      const leaving = shownIds
        .filter((id) => !nextIds.includes(id))
        .map((id) => tray.querySelector(chipSelector(id)))
        .filter((chip) => chip && !chip.classList.contains("motion-chip-remove"));
      if (!leaving.length) return false;
      let pending = leaving.length;
      leaving.forEach((chip) => {
        animateElementOut(chip, () => {
          chip.remove();
          pending -= 1;
          if (pending === 0) rerender();
        }, { className: "motion-chip-remove", timeoutMs: 220 });
      });
      return true;
    },

    /** Shows the tray with fresh content; enters as a whole only when it was hidden. */
    show(nextIds, renderContent) {
      exitToken += 1;
      const wasHidden = tray.hidden || tray.classList.contains("motion-tray-exit");
      tray.classList.remove("motion-tray-exit");
      tray.hidden = false;
      renderContent();
      if (wasHidden) {
        replayMotion(tray, "motion-panel-enter", { timeoutMs: 420 });
      } else {
        const added = nextIds.filter((id) => !shownIds.includes(id));
        if (added.length) markMotionEnter(tray, added.map(chipSelector).join(", "), { limit: added.length });
      }
      shownIds = nextIds.slice();
    },

    /** Fades the tray out once, then hides and empties it unless it was shown again meanwhile. */
    hide() {
      shownIds = [];
      if (tray.hidden) {
        tray.replaceChildren();
        return;
      }
      const token = ++exitToken;
      animateElementOut(tray, () => {
        if (token !== exitToken) return;
        tray.hidden = true;
        tray.replaceChildren();
      }, { className: "motion-tray-exit", timeoutMs: 200 });
    },
  };
}
