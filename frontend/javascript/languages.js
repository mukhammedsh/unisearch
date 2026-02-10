// languages.js
import {
  API_BASE,
  LANG_CONFIG,
  loadProfile,
  saveProfile,
  showToast,
  initCustomSelect,
  escapeHtml,
  getExamDisplayName,
} from "./utils.js";
import { t, tFormat } from "./i18n.js";

const KIND_NATIVE = "native";
const KIND_CEFR = "cefr";
const KIND_EXAM = "exam";

const CEFR_LABEL = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
};

function getConfigOrNull() {
  return (typeof LANG_CONFIG !== "undefined" && LANG_CONFIG) ? LANG_CONFIG : null;
}

function normalizeKind(kindRaw) {
  const kind = String(kindRaw || "").trim().toLowerCase();
  if (kind === "native") return KIND_NATIVE;
  if (kind === "cefr") return KIND_CEFR;
  if (kind === "exam") return KIND_EXAM;
  return "";
}

function getLangLabel(cfg, code) {
  const item = (cfg.languages || []).find(x => x.code === code);
  return item?.name || item?.label || code;
}

function getKindLabel(cfg, kindId) {
  const item = (cfg.proof_kinds || []).find(x => x.id === kindId);
  return item?.label || kindId;
}

function getExamList(cfg, langCode) {
  return (cfg.language_exams && cfg.language_exams[langCode]) ? cfg.language_exams[langCode] : [];
}

function getExam(cfg, langCode, examId) {
  return getExamList(cfg, langCode).find(x => x.id === examId) || null;
}

function setExamInputLimits(inputEl, examObj) {
  if (!inputEl) return;
  if (!examObj) {
    inputEl.removeAttribute("min");
    inputEl.removeAttribute("max");
    inputEl.step = "0.5";
    return;
  }
  inputEl.min = String(examObj.min);
  inputEl.max = String(examObj.max);
  inputEl.step = String(examObj.step ?? 1);
}

function isMultipleOfStep(score, min, step) {
  // устойчиво к float
  const k = (score - min) / step;
  return Math.abs(k - Math.round(k)) < 1e-9;
}

function normalizeProfile(p) {
  const prof = p && typeof p === "object" ? p : {};
  if (!Array.isArray(prof.languages)) prof.languages = [];
  return prof;
}

function normalizeLangEntry(e) {
  if (!e || typeof e !== "object") return null;
  const code = String(e.code || e.lang || "").trim().toLowerCase();
  const kind = normalizeKind(e.kind);
  if (!code || !kind) return null;

  if (kind === KIND_NATIVE) return { code, kind };

  if (kind === KIND_CEFR) {
    const level = Number(e.level);
    if (!Number.isInteger(level) || level < 1 || level > 6) return null;
    return { code, kind, level };
  }

  if (kind === KIND_EXAM) {
    const examId = String(e.exam || e.examId || "").trim();
    const score = Number(e.score);
    if (!examId || Number.isNaN(score)) return null;
    return { code, kind, exam: examId, score };
  }

  return null;
}

export function initLanguagesPanel() {
  const boot = () => {
    const cfg = getConfigOrNull();
    if (!cfg) return;

    const langCode = document.getElementById("langCode");
    const langKind = document.getElementById("langKind");
    const langCefr = document.getElementById("langCefr");
    const langExam = document.getElementById("langExam");
    const langExamScore = document.getElementById("langExamScore");

    const cefrContainer = document.getElementById("cefrContainer");
    const examContainer = document.getElementById("examContainer");
    const scoreContainer = document.getElementById("scoreContainer");

    const langAddBtn = document.getElementById("langAddBtn");
    const langList = document.getElementById("langList");

    if (!langCode || !langKind || !langCefr || !langExam || !langExamScore || !langAddBtn || !langList) {
      return;
    }

    function setUIByKind(kindId) {
      if (cefrContainer) cefrContainer.style.display = (kindId === KIND_CEFR) ? "block" : "none";
      if (examContainer) examContainer.style.display = (kindId === KIND_EXAM) ? "block" : "none";
      if (scoreContainer) scoreContainer.style.display = (kindId === KIND_EXAM) ? "block" : "none";
    }

    function populateLangCode() {
      const current = String(langCode.value || "").trim().toLowerCase();
      langCode.innerHTML = "";
      (cfg.languages || []).forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.code;
        opt.textContent = l.name || l.label || l.code;
        if (opt.value === current) opt.selected = true;
        langCode.appendChild(opt);
      });
    }

    function populateLangKind() {
      const current = normalizeKind(langKind.value);
      langKind.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("languages.select_type", "Select type");
      placeholder.disabled = true;
      placeholder.selected = !current;
      langKind.appendChild(placeholder);

      (cfg.proof_kinds || []).forEach(k => {
        const opt = document.createElement("option");
        opt.value = k.id;      // <-- ВАЖНО: native/cefr/exam
        opt.textContent = k.label;
        if (opt.value === current) opt.selected = true;
        langKind.appendChild(opt);
      });
    }

    function populateLangExam() {
      const code = langCode.value;
      const list = getExamList(cfg, code);
      const current = String(langExam.value || "").trim();
      langExam.innerHTML = "";

      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = t("languages.no_exams", "No exams");
        langExam.appendChild(opt);
        langExam.disabled = true;
        return;
      }

      langExam.disabled = false;
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("languages.select_exam", "Select exam");
      placeholder.disabled = true;
      placeholder.selected = true;
      langExam.appendChild(placeholder);

      list.forEach(ex => {
        const opt = document.createElement("option");
        opt.value = ex.id;
        opt.textContent = ex.label;
        if (opt.value === current) placeholder.selected = false;
        if (opt.value === current) opt.selected = true;
        langExam.appendChild(opt);
      });
    }

    function renderList() {
      const prof = normalizeProfile(loadProfile());
      const arr = prof.languages.map(normalizeLangEntry).filter(Boolean);

      if (JSON.stringify(prof.languages) !== JSON.stringify(arr)) {
        prof.languages = arr; // подчистим мусор
        saveProfile(prof);
      }

      langList.innerHTML = arr.map((e, idx) => {
        const langName = escapeHtml(getLangLabel(cfg, e.code));
        const kindName = escapeHtml(getKindLabel(cfg, e.kind));

        let meta = "";
        if (e.kind === KIND_CEFR) meta = ` — ${escapeHtml(CEFR_LABEL[e.level] || String(e.level))}`;
        if (e.kind === KIND_EXAM) {
          const exObj = getExam(cfg, e.code, e.exam);
          const exLabel = escapeHtml(exObj?.label || getExamDisplayName(e.exam, { langCode: e.code }));
          meta = ` — ${exLabel}: ${escapeHtml(String(e.score))}`;
        }

        return `
          <div class="lang-item">
            <div class="lang-item__main">
              <strong>${langName}</strong>
              <small>${kindName}${meta}</small>
            </div>
            <button class="profile-delete" data-idx="${idx}" type="button">${escapeHtml(t("profile.delete", "Delete"))}</button>
          </div>
        `;
      }).join("");
    }

    function refreshExamLimits() {
      if (langKind.value !== KIND_EXAM) return;
      const exObj = getExam(cfg, langCode.value, langExam.value);
      setExamInputLimits(langExamScore, exObj);
    }

    // ---------- init ----------
    populateLangCode();
    populateLangKind();
    populateLangExam();

    setUIByKind(langKind.value);
    refreshExamLimits();

    // обновляем кастомные селекты сразу (чтобы не ждать “клика куда-то”)
    initCustomSelect("langCode");
    initCustomSelect("langKind");
    initCustomSelect("langCefr");
    initCustomSelect("langExam");

    renderList();

    // ---------- listeners ----------
    langCode.addEventListener("change", () => {
      populateLangExam();
      initCustomSelect("langExam");
      refreshExamLimits();
    });

    langKind.addEventListener("change", () => {
      setUIByKind(langKind.value);
      refreshExamLimits();
    });

    langExam.addEventListener("change", () => {
      refreshExamLimits();
    });

    langExamScore.addEventListener("input", () => {
      if (langKind.value !== KIND_EXAM) return;
      // Allow natural typing like "9.", "6.5" and comma locale input.
      if (langExamScore.value.includes(",")) {
        langExamScore.value = langExamScore.value.replaceAll(",", ".");
      }
    });

    langAddBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      addLanguage();
    });

    async function addLanguage() {
      const prof = normalizeProfile(loadProfile());
      prof.languages = prof.languages.map(normalizeLangEntry).filter(Boolean);

      const code = String(langCode.value || "").trim().toLowerCase();
      const kind = normalizeKind(langKind.value);

      if (!code || !kind) {
        showToast(t("languages.error.choose_language_type", "Choose language and type"), "error");
        return;
      }

      let payload = { code, kind };

      if (kind === KIND_CEFR) {
        const level = Number(langCefr.value);
        if (!Number.isInteger(level) || level < 1 || level > 6) {
          showToast(t("languages.error.choose_cefr", "Choose CEFR level"), "error");
          return;
        }
        payload = { ...payload, level };
      }

      if (kind === KIND_EXAM) {
        const examId = String(langExam.value || "").trim();
        const exObj = getExam(cfg, code, examId);
        if (!exObj) {
          showToast(t("languages.error.choose_exam", "Choose exam"), "error");
          return;
        }

        const rawScore = String(langExamScore.value || "").trim().replaceAll(",", ".");
        if (!rawScore) {
          showToast(t("languages.error.enter_score", "Enter score"), "error");
          return;
        }

        const score = Number(rawScore);
        if (Number.isNaN(score)) {
          showToast(t("languages.error.enter_score", "Enter score"), "error");
          return;
        }

        const examType = String(exObj.type || "").trim().toLowerCase();
        if (examType === "int" && !Number.isInteger(score)) {
          showToast(
            tFormat(
              "languages.error.integer_required",
              { exam: exObj.label || getExamDisplayName(examId, { langCode: code }) },
              `${exObj.label || getExamDisplayName(examId, { langCode: code })} requires an integer score`
            ),
            "error"
          );
          return;
        }

        if (score < exObj.min || score > exObj.max) {
          showToast(`Score must be ${exObj.min} - ${exObj.max}`, "error");
          return;
        }

        const step = Number(exObj.step ?? 1);
        if (!isMultipleOfStep(score, Number(exObj.min), step)) {
          showToast(`Step is ${step} (e.g. ${exObj.min}, ${exObj.min + step}, ...)`, "error");
          return;
        }

        payload = { ...payload, exam: examId, score };
      }

      try {
        const res = await fetch(`${API_BASE}/languages/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail || "Language validation failed");

        const entry = normalizeLangEntry(json?.language);
        if (!entry) throw new Error("Server returned invalid language data");

        let existsIdx = -1;
        if (entry.kind === KIND_EXAM) {
          existsIdx = prof.languages.findIndex(x =>
            x.code === entry.code && x.kind === entry.kind && x.exam === entry.exam
          );
        } else {
          existsIdx = prof.languages.findIndex(x =>
            x.code === entry.code && x.kind === entry.kind
          );
        }

        if (existsIdx >= 0) prof.languages[existsIdx] = entry;
        else prof.languages.push(entry);

        saveProfile(prof);
        renderList();
        if (entry.kind === KIND_EXAM) langExamScore.value = "";
        showToast(t("languages.saved", "Language saved"), "success");
        return;
      } catch (e) {
        showToast(e.message || t("languages.error.save_failed", "Failed to save language"), "error");
      }
    }

    langList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-idx]");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      if (!Number.isFinite(idx)) return;

      const prof = normalizeProfile(loadProfile());
      prof.languages = prof.languages.map(normalizeLangEntry).filter(Boolean);

      prof.languages.splice(idx, 1);
      saveProfile(prof);
      renderList();
      showToast(t("languages.removed", "Removed"), "success");
    });

    // Когда профиль открыли — перерисуем список (и обновим кастомные селекты)
    window.addEventListener("profileModalOpened", () => {
      populateLangCode();
      populateLangKind();
      populateLangExam();
      renderList();
      initCustomSelect("langCode");
      initCustomSelect("langKind");
      initCustomSelect("langCefr");
      initCustomSelect("langExam");
      refreshExamLimits();
    });
  };

  // Если конфиг ещё не успел загрузиться — дождёмся
  if (!getConfigOrNull()) {
    window.addEventListener("languageConfigLoaded", () => boot(), { once: true });
    return;
  }
  boot();
}
