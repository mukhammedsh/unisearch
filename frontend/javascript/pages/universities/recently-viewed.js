import {
  animateElementOut,
  escapeHtml,
  escapeHtmlAttr,
  motionPress,
  replayMotion,
} from "../../utils.js";
import { t, tFormat } from "../../i18n.js";
import { routeUniversityDetail } from "../../routes.js";
import {
  RECENT_UNIVERSITIES_KEY,
  readIdListStorage,
  renderInlineIcon,
  writeIdListStorage,
} from "../_shared.js";

function lockRecentChipWidths(root) {
  if (!root) return;
  root.querySelectorAll(".u-recent__chip").forEach((chip) => {
    chip.style.removeProperty("--recent-chip-width");
  });
}

export function createRecentlyViewedController({
  container,
  getUniversityDisplayNameById,
  universityLinkAttrs,
  scheduleSyncWorkspaceDepth,
}) {
  const close = () => {
    if (!container) return;
    const popover = container.querySelector("#recentlyViewedPopover");
    if (popover?.matches?.(":popover-open")) {
      popover.hidePopover?.();
    }
    popover?.classList.remove("is-open");
    const triggerBtn = container.querySelector("#recentlyViewedBtn");
    triggerBtn?.setAttribute("aria-expanded", "false");
    triggerBtn?.classList.remove("is-active");
  };

  const render = ({ keepOpen = false } = {}) => {
    if (!container) return;
    const existingPopover = container.querySelector("#recentlyViewedPopover");
    const wasOpen = Boolean(
      keepOpen
      || existingPopover?.matches?.(":popover-open")
      || existingPopover?.classList.contains("is-open")
    );
    const recentIds = readIdListStorage(RECENT_UNIVERSITIES_KEY).slice(0, 6);
    if (!recentIds.length) {
      if (existingPopover?.matches?.(":popover-open")) existingPopover.hidePopover?.();
      container.hidden = true;
      container.replaceChildren();
      scheduleSyncWorkspaceDepth();
      return;
    }
    const rows = recentIds
      .map((id) => ({ id, label: getUniversityDisplayNameById(id) }))
      .filter((row) => row.label);
    if (!rows.length) {
      if (existingPopover?.matches?.(":popover-open")) existingPopover.hidePopover?.();
      container.hidden = true;
      container.replaceChildren();
      scheduleSyncWorkspaceDepth();
      return;
    }
    const titleText = t("universities.recent.title", "Recently viewed");
    const clearAllText = t("universities.recent.clear_all", "Clear all");
    container.hidden = false;
    container.innerHTML = `
      <button
        id="recentlyViewedBtn"
        class="ui-btn ui-btn--on-bg u-recent-trigger"
        type="button"
        popovertarget="recentlyViewedPopover"
        aria-controls="recentlyViewedPopover"
        aria-expanded="false"
        title="${escapeHtmlAttr(titleText)}"
        aria-label="${escapeHtmlAttr(`${titleText} (${rows.length})`)}"
      >
        ${renderInlineIcon("clock", 16, "u-recent-trigger__icon")}
        <span class="u-recent-trigger__label">${escapeHtml(titleText)}</span>
        <span class="u-recent-trigger__count" aria-hidden="true">${rows.length}</span>
        ${renderInlineIcon("chevron-down", 14, "u-recent-trigger__chevron")}
      </button>
      <div
        id="recentlyViewedPopover"
        class="u-recent-popover${wasOpen ? "" : " motion-top-layer"}"
        popover="auto"
        aria-label="${escapeHtmlAttr(titleText)}"
      >
        <div class="u-recent__items">
          ${rows.map((row) => {
            const removeLabel = tFormat(
              "universities.recent.remove",
              { university: row.label },
              `Remove ${row.label} from recently viewed`
            );
            return `
              <span class="u-recent__chip">
                <a class="u-recent__link" href="${routeUniversityDetail(row.id)}"${universityLinkAttrs()}>${escapeHtml(row.label)}</a>
                <button
                  class="ui-btn ui-btn--icon ui-btn--ghost u-recent__remove"
                  type="button"
                  data-action="remove-recent"
                  data-uni-id="${escapeHtmlAttr(row.id)}"
                  aria-label="${escapeHtmlAttr(removeLabel)}"
                  title="${escapeHtmlAttr(removeLabel)}"
                >${renderInlineIcon("x-mark", 14, "u-recent__remove-icon")}</button>
              </span>
            `;
          }).join("")}
        </div>
        <div class="u-recent__footer">
          <button class="ui-btn ui-btn--sm ui-btn--ghost u-recent__clear" type="button" data-action="clear-recent">
            ${renderInlineIcon("x-mark", 14, "u-recent__clear-icon")}
            <span>${escapeHtml(clearAllText)}</span>
          </button>
        </div>
      </div>
    `;
    lockRecentChipWidths(container);
    scheduleSyncWorkspaceDepth();

    const triggerBtn = container.querySelector("#recentlyViewedBtn");
    const popoverEl = container.querySelector("#recentlyViewedPopover");
    const supportsNativePopover = Boolean(popoverEl && typeof popoverEl.showPopover === "function");
    const syncTriggerExpanded = (isOpen) => {
      triggerBtn?.setAttribute("aria-expanded", isOpen ? "true" : "false");
      triggerBtn?.classList.toggle("is-active", isOpen);
    };

    if (supportsNativePopover) {
      popoverEl.addEventListener("toggle", (event) => {
        syncTriggerExpanded(event.newState === "open");
      });
      if (wasOpen) {
        try {
          popoverEl.showPopover();
        } catch (err) {
          console.warn("Unable to reopen recently viewed popover", err);
        }
        // Re-rendering an open popover must not replay its entrance: settle the open style first,
        // then opt into motion so only the later close animates.
        void popoverEl.offsetWidth;
        popoverEl.classList.add("motion-top-layer");
      }
    } else if (triggerBtn && popoverEl) {
      triggerBtn.addEventListener("click", () => {
        const nextOpen = !popoverEl.classList.contains("is-open");
        popoverEl.classList.toggle("is-open", nextOpen);
        syncTriggerExpanded(nextOpen);
      });
      if (wasOpen) {
        popoverEl.classList.add("is-open");
        void popoverEl.offsetWidth;
        popoverEl.classList.add("motion-top-layer");
        syncTriggerExpanded(true);
      }
    }

    container.querySelector('[data-action="clear-recent"]')?.addEventListener("click", () => {
      const clearBtn = container.querySelector('[data-action="clear-recent"]');
      motionPress(clearBtn);
      replayMotion(clearBtn?.querySelector(".u-recent__clear-icon") || clearBtn, "motion-icon-clear", { timeoutMs: 240 });
      animateElementOut(popoverEl || container, () => {
        writeIdListStorage(RECENT_UNIVERSITIES_KEY, []);
        render({ keepOpen: false });
      }, { className: "motion-row-exit", timeoutMs: 280 });
    });

    container.querySelectorAll('[data-action="remove-recent"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const uniId = String(button.getAttribute("data-uni-id") || "").trim();
        if (!uniId) return;
        const chip = button.closest(".u-recent__chip");
        motionPress(button);
        replayMotion(button.querySelector(".u-recent__remove-icon") || button, "motion-icon-remove", { timeoutMs: 240 });
        animateElementOut(chip, () => {
          const nextIds = readIdListStorage(RECENT_UNIVERSITIES_KEY).filter((id) => id !== uniId);
          writeIdListStorage(RECENT_UNIVERSITIES_KEY, nextIds);
          render({ keepOpen: nextIds.length > 0 });
        }, { className: "motion-chip-remove", timeoutMs: 260 });
      });
    });
  };

  const dispose = () => {
    close();
  };

  return { render, close, dispose };
}
