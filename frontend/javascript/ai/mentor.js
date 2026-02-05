import { API_BASE, UNIMENTOR_CONFIG, aiName, escapeHtml, loadProfile, initCustomSelect } from "../utils.js";

const MODE_STORAGE_KEY = "unimentor_mode";

function normalizeMode(value) {
  const m = String(value || "").trim().toLowerCase();
  if (m === "gemini" || m === "fallback" || m === "local") return m;
  return "auto";
}

function modeLabel(mode) {
  if (mode === "gemini") return "Gemini";
  if (mode === "fallback") return "Fallback model";
  if (mode === "local") return "Local fallback";
  return "Auto";
}

function setModeBadge(el, text) {
  if (!el) return;
  el.textContent = text;
}

function formatMentorText(text) {
  let out = String(text || "").replace(/\r\n/g, "\n");
  // Strip common markdown markers that look ugly in plain chat bubbles.
  out = out.replace(/\*\*(.*?)\*\*/g, "$1");
  out = out.replace(/`([^`]+)`/g, "$1");
  out = out
    .split("\n")
    .map((line) => line.replace(/^\s*[*-]\s+/, "• "))
    .join("\n")
    .trim();
  return escapeHtml(out).replace(/\n/g, "<br>");
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return "";
  return `
    <div class="mentor-sources">
      ${sources
        .map((s) => {
          const title = escapeHtml(s?.title || "Source");
          const url = escapeHtml(s?.url || "#");
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`;
        })
        .join("")}
    </div>
  `;
}

function renderQuickOptions(options) {
  if (!Array.isArray(options) || !options.length) return "";
  const list = options
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!list.length) return "";
  return `
    <div class="mentor-options">
      ${list.map((q) => `<button type="button" class="mentor-option-btn" data-mentor-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("")}
    </div>
  `;
}

function messageHtml(role, text, sources = [], options = []) {
  const cls = role === "user" ? "mentor-msg mentor-msg--user" : "mentor-msg mentor-msg--assistant";
  return `
    <div class="${cls}">
      <div class="mentor-msg-body">${formatMentorText(text)}</div>
      ${role === "assistant" ? renderSources(sources) : ""}
      ${role === "assistant" ? renderQuickOptions(options) : ""}
    </div>
  `;
}

export function initUniMentor(university) {
  const panel = document.getElementById("mentorPanel");
  const messages = document.getElementById("mentorMessages");
  const input = document.getElementById("mentorInput");
  const sendBtn = document.getElementById("mentorSendBtn");
  const clearBtn = document.getElementById("mentorClearBtn");
  const disabledNote = document.getElementById("mentorDisabledNote");
  const title = document.getElementById("mentorAssistantName");
  const modeSelect = document.getElementById("mentorModeSelect");
  const modeBadge = document.getElementById("mentorModeBadge");
  if (!panel || !messages || !input || !sendBtn) return;

  const mentorName = aiName("mentor");
  if (title) title.textContent = mentorName;

  const rawSavedMode = localStorage.getItem(MODE_STORAGE_KEY);
  const savedMode = rawSavedMode ? normalizeMode(rawSavedMode) : "";
  const configMode = UNIMENTOR_CONFIG?.mode ? normalizeMode(UNIMENTOR_CONFIG.mode) : "";
  const initialMode = savedMode || configMode || "auto";
  if (modeSelect) modeSelect.value = initialMode;
  setModeBadge(modeBadge, `Mode: ${modeLabel(initialMode)} (selected)`);

  if (!UNIMENTOR_CONFIG.enabled) {
    if (disabledNote) disabledNote.style.display = "block";
    sendBtn.disabled = true;
    input.disabled = true;
    if (modeSelect) modeSelect.disabled = true;
    return;
  }

  if (modeSelect) initCustomSelect("mentorModeSelect");

  const intro = `Hi! I am ${mentorName}. Ask me about ${university?.name || "this university"}: admission, language requirements, costs, scholarships, ranking, or campus info.`;
  messages.innerHTML = messageHtml("assistant", intro);

  const setBusy = (busy) => {
    sendBtn.disabled = busy;
    input.disabled = busy;
    sendBtn.textContent = busy ? "Thinking..." : "Send";
  };

  const ask = async (forcedQuestion = "") => {
    const hasForcedQuestion =
      typeof forcedQuestion === "string" && forcedQuestion.trim().length > 0;
    const question = hasForcedQuestion
      ? forcedQuestion.trim()
      : String(input.value || "").trim();
    if (!question) return;

    messages.insertAdjacentHTML("beforeend", messageHtml("user", question));
    messages.scrollTop = messages.scrollHeight;
    input.value = "";
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/mentor/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          university_id: university?.id || "",
          online: !!UNIMENTOR_CONFIG.online,
          profile: loadProfile(),
          mode: normalizeMode(modeSelect?.value || initialMode),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Mentor request failed");

      const provider = String(data?.provider || "local").toLowerCase();
      const requested = String(data?.provider_requested || provider).toLowerCase();
      const modelUsed = String(data?.model_used || "").trim();
      const warning = String(data?.warning || "").trim();
      if (provider === "gemini") {
        setModeBadge(modeBadge, `Now: Gemini (${modelUsed || "model"})`);
      } else {
        setModeBadge(modeBadge, "Now: Local fallback model");
      }
      if (requested.startsWith("gemini") && provider !== "gemini") {
        const note = warning || "Gemini is not available right now, switched to local UniMentor mode.";
        messages.insertAdjacentHTML("beforeend", messageHtml("assistant", note));
      }

      messages.insertAdjacentHTML(
        "beforeend",
        messageHtml(
          "assistant",
          data?.answer || "Sorry, I could not generate an answer.",
          data?.sources || [],
          data?.quick_options || []
        )
      );
      messages.scrollTop = messages.scrollHeight;
    } catch (e) {
      messages.insertAdjacentHTML(
        "beforeend",
        messageHtml("assistant", `I could not answer right now: ${e.message || "Unknown error"}`)
      );
    } finally {
      setBusy(false);
      input.focus();
    }
  };

  sendBtn.addEventListener("click", () => {
    ask();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ask();
    }
  });

  clearBtn?.addEventListener("click", () => {
    messages.innerHTML = messageHtml("assistant", intro);
  });

  modeSelect?.addEventListener("change", () => {
    const mode = normalizeMode(modeSelect.value);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    setModeBadge(modeBadge, `Mode: ${modeLabel(mode)} (selected)`);
  });

  messages.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".mentor-option-btn");
    if (!btn) return;
    if (sendBtn.disabled) return;
    const q = String(btn.getAttribute("data-mentor-q") || "").trim();
    if (!q) return;
    input.value = q;
    ask(q);
  });
}
