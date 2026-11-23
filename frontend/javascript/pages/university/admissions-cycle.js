// Reading an admission context for the one entry cycle a path publishes. The university page, its Overview and the
// comparison all read a path the same way: when the check needs an entry year and the path publishes exactly one, that
// year is used, so the minimums are compared instead of left unassessed.
import { singlePublishedCycle } from "./admissions-controller.js";

/**
 * Reads a context and, when the answer says an entry cycle is required and the path publishes exactly one, reads it again for that cycle.
 * A cycle the reader already set is never replaced, and the returned cycle is not stored anywhere.
 * @param {(context: object) => Promise<object>} read Performs one admissions-context request for a context.
 * @param {object} context The context to read (study option, route, level, entry cycle, fee status).
 * @returns {Promise<{resolved: object, cycle: string}>} The response and the cycle filled in ("" when none was).
 */
export async function readForSinglePublishedCycle(read, context) {
  const resolved = await read(context);
  const cycle = !context?.intended_entry_cycle && resolved?.assessment?.reason === "entry_cycle_required" ? singlePublishedCycle(resolved) : "";
  return cycle ? { resolved: await read({ ...context, intended_entry_cycle: cycle }), cycle } : { resolved, cycle: "" };
}
