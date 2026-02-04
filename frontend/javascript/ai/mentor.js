import { API_BASE, UNIMENTOR_CONFIG, aiName, escapeHtml, loadProfile } from "../utils.js";

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

function messageHtml(role, text, sources = []) {
  const cls = role === "user" ? "mentor-msg mentor-msg--user" : "mentor-msg mentor-msg--assistant";
  return `
    <div class="${cls}">
      <div class="mentor-msg-body">${escapeHtml(text || "")}</div>
      ${role === "assistant" ? renderSources(sources) : ""}
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
  if (!panel || !messages || !input || !sendBtn) return;

  const mentorName = aiName("mentor");
  if (title) title.textContent = mentorName;

  if (!UNIMENTOR_CONFIG.enabled) {
    if (disabledNote) disabledNote.style.display = "block";
    sendBtn.disabled = true;
    input.disabled = true;
    return;
  }

  const intro = `Hi! I am ${mentorName}. Ask me about ${university?.name || "this university"}: admission, language requirements, costs, scholarships, ranking, or campus info.`;
  messages.innerHTML = messageHtml("assistant", intro);

  const setBusy = (busy) => {
    sendBtn.disabled = busy;
    input.disabled = busy;
    sendBtn.textContent = busy ? "Thinking..." : "Send";
  };

  const ask = async () => {
    const question = String(input.value || "").trim();
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Mentor request failed");

      messages.insertAdjacentHTML(
        "beforeend",
        messageHtml("assistant", data?.answer || "Sorry, I could not generate an answer.", data?.sources || [])
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

  sendBtn.addEventListener("click", ask);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ask();
    }
  });

  clearBtn?.addEventListener("click", () => {
    messages.innerHTML = messageHtml("assistant", intro);
  });
}
