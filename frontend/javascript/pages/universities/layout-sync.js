/* frontend/javascript/pages/universities/layout-sync.js */

import { $, safeSessionStorage, setManualScrollRestoration } from "../../utils.js";

const UNIVERSITIES_SCROLL_KEY = "unisearch_universities_scroll";

/**
 * Manage universities workspace depth alignment, sidebar sizing, status overflow popovers,
 * mobile filter button footer clearance, and list scroll persistence.
 * @param {{
 *   el: Record<string, any>,
 *   state: Record<string, any>,
 *   onResize?: () => void,
 * }} options
 */
export function createLayoutSyncController({ el, state, onResize }) {
    setManualScrollRestoration();

    let lastAppliedLayoutDepth = "";
    let depthSyncRafId = 0;
    let sidebarMaxHeightRafId = 0;
    let lastAppliedSidebarMaxHeight = null;
    let scrollSaveTimer = null;

    let scrollHandler = null;
    let pagehideHandler = null;
    let beforeunloadHandler = null;
    let resizeHandler = null;
    let resizeObserver = null;
    let overflowClickHandler = null;
    let overflowKeydownHandler = null;

    const getSidebarNode = () => el.sidebar || $("uSidebar") || document.querySelector(".u-sidebar");
    const getContentNode = () => el.catalogPane || el.content || document.querySelector(".u-content");

    const closeAllStatusOverflows = () => {
        document.querySelectorAll(".uni-status-overflow.is-open").forEach((wrap) => {
            wrap.classList.remove("is-open");
            const trigger = wrap.querySelector(".uni-status-overflow-trigger");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
            const popover = wrap.querySelector(".uni-status-overflow-popover");
            if (popover) popover.hidden = true;
        });
    };

    const saveCurrentScrollPosition = () => {
        if (state.activeTab !== "catalog" || state.viewMode !== "list") return;
        const currentY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
        safeSessionStorage.set(UNIVERSITIES_SCROLL_KEY, String(currentY));
    };

    const clearSavedScrollPosition = () => {
        safeSessionStorage.remove(UNIVERSITIES_SCROLL_KEY);
    };

    const restoreScrollPosition = () => {
        if (state.activeTab !== "catalog" || state.viewMode !== "list") return;
        const rawY = safeSessionStorage.get(UNIVERSITIES_SCROLL_KEY);
        const targetY = rawY !== null ? Math.max(0, Number.parseInt(rawY, 10) || 0) : 0;
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
        });
    };

    // In map mode the sidebar keeps its own internal scroll, but its outer
    // height is clamped to the content column so the filter column, the map,
    // and the results rail all end at the same depth.
    const clearMapSidebarDepth = () => {
        const sidebar = getSidebarNode();
        if (sidebar) sidebar.style.removeProperty("height");
    };

    const syncMapSidebarDepth = () => {
        const sidebar = getSidebarNode();
        const content = getContentNode();
        if (!sidebar || !content) return;
        // Below the split breakpoint the columns stack; the stylesheet
        // rules apply untouched there.
        if (state.viewMode !== "map" || window.innerWidth <= 1180) {
            clearMapSidebarDepth();
            return;
        }
        clearMapSidebarDepth();
        const targetH = content.offsetHeight || 0;
        if (targetH > 0) sidebar.style.height = `${targetH}px`;
    };

    const syncSidebarMaxHeight = () => {
        if (typeof window === "undefined") return;
        const sidebar = getSidebarNode();
        if (!sidebar) return;

        if (window.innerWidth <= 1024 || (state.viewMode === "map" && window.innerWidth > 1180)) {
            if (lastAppliedSidebarMaxHeight !== null) {
                lastAppliedSidebarMaxHeight = null;
                sidebar.style.removeProperty("--sidebar-max-height");
            }
            return;
        }

        // Independent panels invariant: sidebar geometry must never depend on
        // the live scroll position. Derive the height from offsets that do not
        // change while scrolling: the sticky `top` and the layout's document
        // offset (where the unscrolled sidebar starts). Using the larger of the
        // two keeps the panel's bottom inside the viewport before the page is
        // scrolled, so the end of the filters is never hidden below the fold.
        const computedTop = Number.parseFloat(window.getComputedStyle(sidebar).top) || 90;
        const layoutTop = el.workspaceLayout
            ? el.workspaceLayout.getBoundingClientRect().top + window.scrollY
            : 0;
        const startTop = Math.max(computedTop, layoutTop);
        const bottomGap = 16;
        const availableHeight = Math.max(200, Math.floor(window.innerHeight - startTop - bottomGap));
        if (lastAppliedSidebarMaxHeight !== availableHeight) {
            lastAppliedSidebarMaxHeight = availableHeight;
            sidebar.style.setProperty("--sidebar-max-height", `${availableHeight}px`);
        }
    };

    const syncWorkspaceDepth = () => {
        if (depthSyncRafId) {
            window.cancelAnimationFrame(depthSyncRafId);
            depthSyncRafId = 0;
        }
        if (!el.workspaceLayout || typeof window === "undefined") return;

        if (state.viewMode !== "map") clearMapSidebarDepth();

        // Mobile / tablet screen layouts stack vertically, do not force desktop depth
        if (window.innerWidth <= 1024) {
            if (lastAppliedLayoutDepth !== "") {
                lastAppliedLayoutDepth = "";
                el.workspaceLayout.style.removeProperty("min-height");
            }
            clearMapSidebarDepth();
            return;
        }

        // Map mode content is short and stable; forcing list-mode depth would
        // leave a large empty area below the map.
        if (state.viewMode === "map") {
            if (lastAppliedLayoutDepth !== "") {
                lastAppliedLayoutDepth = "";
                el.workspaceLayout.style.removeProperty("min-height");
            }
            syncMapSidebarDepth();
            return;
        }

        const sidebar = getSidebarNode();
        const content = getContentNode();
        if (!sidebar || !content) return;

        const filterCard = el.filterCard || sidebar.querySelector(".u-filter-card");

        let leftColHeight = 0;
        if (filterCard) {
            leftColHeight += filterCard.offsetHeight;
        }
        leftColHeight = Math.max(leftColHeight, sidebar.scrollHeight || 0);

        const rightColHeight = content.offsetHeight || 0;
        const targetDepth = Math.max(leftColHeight, rightColHeight);
        const targetStr = targetDepth > 0 ? `${targetDepth}px` : "";

        if (lastAppliedLayoutDepth !== targetStr) {
            lastAppliedLayoutDepth = targetStr;
            if (targetStr) {
                el.workspaceLayout.style.minHeight = targetStr;
            } else {
                el.workspaceLayout.style.removeProperty("min-height");
            }
        }
        syncSidebarMaxHeight();
    };

    const scheduleSyncSidebarMaxHeight = () => {
        if (typeof window === "undefined") return;
        if (sidebarMaxHeightRafId) return;
        sidebarMaxHeightRafId = window.requestAnimationFrame(() => {
            sidebarMaxHeightRafId = 0;
            syncSidebarMaxHeight();
        });
    };

    const scheduleSyncWorkspaceDepth = () => {
        if (typeof window === "undefined") return;
        scheduleSyncSidebarMaxHeight();
        if (depthSyncRafId) return;
        depthSyncRafId = window.requestAnimationFrame(() => {
            depthSyncRafId = 0;
            syncWorkspaceDepth();
        });
    };

    const syncMobileFilterFooterClearance = () => {
        const toggleBtn = el.mobileFilterToggle || $("mobileFilterToggle");
        if (!toggleBtn) return;
        if (window.innerWidth > 1024) {
            toggleBtn.style.removeProperty("--u-mobile-filter-footer-clearance");
            return;
        }

        const footer = document.querySelector(".site-footer");
        if (!footer) return;
        const footerClearance = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top + 16);
        toggleBtn.style.setProperty("--u-mobile-filter-footer-clearance", `${Math.ceil(footerClearance)}px`);
    };

    const bindEvents = () => {
        overflowClickHandler = (evt) => {
            const target = evt.target instanceof Element ? evt.target : null;
            if (!target) return;

            const trigger = target.closest(".uni-status-overflow-trigger");
            if (trigger) {
                evt.preventDefault();
                evt.stopPropagation();
                const wrap = trigger.closest(".uni-status-overflow");
                if (!wrap) return;
                const popover = wrap.querySelector(".uni-status-overflow-popover");
                const isCurrentlyOpen = wrap.classList.contains("is-open");

                closeAllStatusOverflows();

                if (!isCurrentlyOpen) {
                    wrap.classList.add("is-open");
                    trigger.setAttribute("aria-expanded", "true");
                    if (popover) popover.hidden = false;
                }
                return;
            }

            if (!target.closest(".uni-status-overflow")) {
                closeAllStatusOverflows();
            }
        };
        document.addEventListener("click", overflowClickHandler);

        overflowKeydownHandler = (evt) => {
            if (evt.key === "Escape") {
                const openWrap = document.querySelector(".uni-status-overflow.is-open");
                if (openWrap) {
                    evt.preventDefault();
                    const trigger = openWrap.querySelector(".uni-status-overflow-trigger");
                    closeAllStatusOverflows();
                    if (trigger && typeof trigger.focus === "function") {
                        trigger.focus();
                    }
                }
            }
        };
        document.addEventListener("keydown", overflowKeydownHandler);

        scrollHandler = () => {
            // Independent panels invariant: window scroll must never recompute
            // sidebar geometry (see syncSidebarMaxHeight). Only viewport
            // clearance and scroll persistence are scroll-safe here.
            syncMobileFilterFooterClearance();
            if (scrollSaveTimer) return;
            scrollSaveTimer = window.setTimeout(() => {
                scrollSaveTimer = null;
                saveCurrentScrollPosition();
            }, 150);
        };
        pagehideHandler = saveCurrentScrollPosition;
        beforeunloadHandler = saveCurrentScrollPosition;

        window.addEventListener("scroll", scrollHandler, { passive: true });
        window.addEventListener("pagehide", pagehideHandler);
        window.addEventListener("beforeunload", beforeunloadHandler);

        resizeHandler = () => {
            scheduleSyncWorkspaceDepth();
            scheduleSyncSidebarMaxHeight();
            syncMobileFilterFooterClearance();
            onResize?.();
        };
        window.addEventListener("resize", resizeHandler, { passive: true });
        syncMobileFilterFooterClearance();

        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                scheduleSyncWorkspaceDepth();
                scheduleSyncSidebarMaxHeight();
            });
            const sidebarNode = getSidebarNode();
            const contentNode = getContentNode();
            if (sidebarNode) resizeObserver.observe(sidebarNode);
            if (contentNode) resizeObserver.observe(contentNode);
            if (el.recentlyViewedBar) resizeObserver.observe(el.recentlyViewedBar);
            const filterCardNode = el.filterCard || sidebarNode?.querySelector(".u-filter-card");
            if (filterCardNode) resizeObserver.observe(filterCardNode);
        }
    };

    const dispose = () => {
        if (depthSyncRafId) {
            window.cancelAnimationFrame(depthSyncRafId);
            depthSyncRafId = 0;
        }
        if (sidebarMaxHeightRafId) {
            window.cancelAnimationFrame(sidebarMaxHeightRafId);
            sidebarMaxHeightRafId = 0;
        }
        if (scrollSaveTimer) {
            window.clearTimeout(scrollSaveTimer);
            scrollSaveTimer = null;
        }
        if (scrollHandler) {
            window.removeEventListener("scroll", scrollHandler);
            scrollHandler = null;
        }
        if (pagehideHandler) {
            window.removeEventListener("pagehide", pagehideHandler);
            pagehideHandler = null;
        }
        if (beforeunloadHandler) {
            window.removeEventListener("beforeunload", beforeunloadHandler);
            beforeunloadHandler = null;
        }
        if (resizeHandler) {
            window.removeEventListener("resize", resizeHandler);
            resizeHandler = null;
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (overflowClickHandler) {
            document.removeEventListener("click", overflowClickHandler);
            overflowClickHandler = null;
        }
        if (overflowKeydownHandler) {
            document.removeEventListener("keydown", overflowKeydownHandler);
            overflowKeydownHandler = null;
        }
    };

    return {
        saveCurrentScrollPosition,
        clearSavedScrollPosition,
        restoreScrollPosition,
        syncWorkspaceDepth,
        syncSidebarMaxHeight,
        scheduleSyncSidebarMaxHeight,
        scheduleSyncWorkspaceDepth,
        syncMobileFilterFooterClearance,
        bindEvents,
        dispose,
    };
}
