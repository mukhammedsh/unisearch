const editorHistoryKey = "unisearchProfileEditor";

/**
 * Window event that asks the profile to show one of its sections.
 * detail: { section: string, replaceHistory?: boolean }; the handler sets detail.result to a Promise<boolean>
 * that resolves to whether the section is now shown (false when the applicant keeps editing the current one).
 */
export const SHOW_PROFILE_SECTION_EVENT = "unisearch:show-profile-section";

// Internal entries share the SPA route index so its cross-page guard stays in charge of leaving Profile.
export function isProfileEditorHistoryEntry(entry = window.history.state) {
    const editor = entry?.[editorHistoryKey];
    return !!editor && editor.routeIndex === (entry.appRouteHistoryIndex ?? 0);
}

export function bindProfileSections(els, { requestNavigationClose, listen, onSectionChange }) {
    const wideLayout = window.matchMedia("(min-width: 901px)");
    const pageUrl = window.location.href;
    const currentHistorySection = (entry) => isProfileEditorHistoryEntry(entry) ? entry[editorHistoryKey].section : "";
    const findPanel = (id) => els.profileSectionNodes.find((panel) => panel.dataset.profileSection === id);
    let section = currentHistorySection(window.history.state);
    let navigating = false;
    let restoringHistory = false;

    const render = (focus = false, previousSection = "") => {
        const panel = findPanel(section || (wideLayout.matches ? "basics" : ""));
        els.modal.dataset.profileView = panel ? "editor" : "overview";
        els.profileSectionNodes.forEach((node) => { node.hidden = node !== panel; });
        els.profileSectionTabs.forEach((button) => {
            const active = button.dataset.profileTab === panel?.dataset.profileSection;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "true");
            else button.removeAttribute("aria-current");
        });
        if (!focus) return;
        const trigger = els.profileSectionTabs.find((button) => button.dataset.profileTab === previousSection);
        const target = !section && trigger ? trigger : panel?.querySelector(".profile-section-title");
        target?.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
    };

    const showSection = (id, { focusHeading = true, replaceHistory = false } = {}) => {
        if (!findPanel(id) || section === id) return;
        const entry = window.history.state;
        const method = replaceHistory || isProfileEditorHistoryEntry(entry) ? "replaceState" : "pushState";
        window.history[method]({
            ...entry,
            [editorHistoryKey]: { section: id, routeIndex: entry?.appRouteHistoryIndex ?? 0 },
        }, "");
        section = id;
        render(focusHeading);
        onSectionChange();
    };

    const navigateSection = async (id) => {
        if (navigating || !findPanel(id)) return false;
        if (!findPanel(id).hidden) return true;
        navigating = true;
        try {
            if (!(await requestNavigationClose())) return false;
            showSection(id);
            return true;
        } finally {
            navigating = false;
        }
    };

    const onHistoryChange = async (event) => {
        // A different app route belongs to the SPA's navigation guard.
        if (!els.modal.isConnected || window.location.href !== pageUrl || event.state?.appRouteHistoryIndex !== routeIndex) return;
        const next = currentHistorySection(event.state);
        if (restoringHistory) {
            restoringHistory = false;
            return;
        }
        if (next === section) return;
        const previous = section;
        const allowed = await requestNavigationClose();
        if (!els.modal.isConnected || window.location.href !== pageUrl) return;
        if (!allowed) {
            restoringHistory = true;
            window.history[previous ? "forward" : "back"]();
            return;
        }
        section = next;
        render(true, previous);
        onSectionChange();
    };

    const routeIndex = window.history.state?.appRouteHistoryIndex;
    els.profileSectionTabs.forEach((button) => {
        button.addEventListener("click", () => { void navigateSection(button.dataset.profileTab); });
    });
    els.modal.querySelectorAll("[data-profile-jump]").forEach((button) => {
        button.addEventListener("click", () => { void navigateSection(button.dataset.profileJump); });
    });
    els.sectionBackBtn?.addEventListener("click", () => window.history.back());
    // Another profile panel asks for a section, for example the language editor opened from a link or a test shortcut.
    // A link opening the profile replaces its history entry, so Back returns to the page that linked here.
    listen(window, SHOW_PROFILE_SECTION_EVENT, (event) => {
        const detail = event.detail || {};
        if (detail.replaceHistory) {
            showSection(detail.section, { focusHeading: false, replaceHistory: true });
            detail.result = Promise.resolve(Boolean(findPanel(detail.section)));
            return;
        }
        detail.result = navigateSection(detail.section);
    });
    listen(window, "popstate", onHistoryChange);
    listen(wideLayout, "change", () => render());
    render();
    return { showSection, navigateSection };
}
