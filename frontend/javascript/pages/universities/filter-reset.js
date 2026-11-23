/* frontend/javascript/pages/universities/filter-reset.js */

/**
 * The catalog state a "Reset filters" restores: the search text and every filter go back to their defaults.
 * The order is the visitor's choice, not a filter, so the chosen sort stays with the UniFit sliders that tune it;
 * only "relevance" is dropped, because it exists for a search that has just been cleared.
 * @param {{sort?: string}} state The current catalog state.
 * @param {{fundingType: string, limits: {min: number, max: number}, onlySaved: boolean}} defaults Defaults the reset restores.
 * @returns {Record<string, string | number | boolean>} The fields to assign to the state.
 */
export function buildFilterResetPatch(state, { fundingType, limits, onlySaved }) {
    return {
        q: "",
        country: "",
        region: "",
        city: "",
        study_level: "",
        cost_basis: "annual_total",
        funding_type: fundingType,
        min_tuition: limits.min,
        max_tuition: limits.max,
        sort: state.sort === "relevance" ? "name_asc" : state.sort || "name_asc",
        only_saved: onlySaved,
        only_reviewed: false,
        page: 1,
    };
}
