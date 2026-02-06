/* 2. components.js - Элементы интерфейса */
import {
  loadProfile,
  saveProfile,
  initCustomSelect,
  EXAM_CONFIG,
  getExamDisplayName,
  escapeHtml,
  showToast,
  API_BASE,
  MAJOR_OPTIONS,
  toggleTheme,
  getCurrentTheme,
} from "./utils.js";

function syncNavbarLogo(themeOverride = "") {
    const navbarLogo = document.querySelector(".logo[data-logo-light][data-logo-dark]");
    if (!navbarLogo) return;
    const theme = (themeOverride || getCurrentTheme() || "light").toLowerCase();
    const nextLogo = theme === "dark" ? "images/darklogo.png" : "images/whitelogo.png";
    if (!nextLogo) return;
    if (navbarLogo.getAttribute("src") !== nextLogo) {
        navbarLogo.dataset.fallback = "0";
        navbarLogo.setAttribute("src", nextLogo);
    }
}

let __themeUiSyncBound = false;
function bindThemeUiSync() {
    if (__themeUiSyncBound) return;
    __themeUiSyncBound = true;

    const syncNow = () => syncNavbarLogo();

    try {
        const obs = new MutationObserver(() => syncNow());
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {
        // ignore
    }

    window.addEventListener("load", syncNow);
    window.addEventListener("pageshow", syncNow);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) syncNow();
    });
}

// HTML-код меню и профиля (вшит прямо сюда, чтобы избежать проблем с загрузкой файлов)
const LAYOUT_HTML = `
<header class="navbar">
  <div class="navbar-left">
    <a href="index.html" style="display: flex; align-items: center;">
      <img
        src="images/whitelogo.png"
        data-logo-light="images/whitelogo.png"
        data-logo-dark="images/darklogo.png"
        onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='images/minilogo.png';}"
        alt="Logo"
        class="logo"
      />
    </a>
  </div>

  <nav class="navbar-center">
    <a href="index.html" data-link="home">Home</a>
    <a href="universities.html" data-link="universities">Universities</a>
    <a href="ranking.html" data-link="ranking">Rankings</a>
    <a href="guide.html" data-link="guide">Guide</a>
    <a href="about.html" data-link="about">About Us</a>
  </nav>

  <div class="navbar-right">
    <button class="theme-btn" id="themeToggleBtn" type="button" title="Switch theme" aria-label="Switch theme">🌙</button>
    <button class="login-btn" id="profileBtn">Profile</button>
  </div>
</header>

<div class="profile-modal" id="profileModal">
  <div class="profile-backdrop" data-close="profile"></div>
  <div class="profile-card" role="dialog">
    <div class="profile-header">
      <div class="profile-title">
        <div class="profile-username">
          <span id="profileNameDisplay">User</span>
          <input id="profileNameInput" class="profile-name-input" type="text" value="User" minlength="3" maxlength="16" />
          <button class="icon-btn" id="editNameBtn" title="Edit Name">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M14 6l4 4"/></svg>
          </button>
        </div>
        <div class="profile-subtitle">Profile</div>
      </div>
      <button class="icon-btn profile-close" id="profileCloseBtn" title="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
      </button>
    </div>

    <div id="usernameError" class="profile-error profile-error--username"></div>

    <div class="profile-body">
      
      <div class="profile-field">
        <label class="profile-label">Total Budget per year (USD)</label>
        <div class="profile-budget">
          <input id="budgetInput" class="profile-input" type="text" placeholder="e.g. 20000" />
          <button id="saveBudgetBtn" class="icon-btn profile-save-btn" title="Save Budget">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <span class="profile-unit">USD / year</span>
        </div>
        <div class="profile-hint">Range: 1 - 1,000,000</div>
      </div>

      <div class="profile-field">
        <label class="profile-label">Preferred Study Mode</label>
        <select id="studyModeSelect" class="profile-input" style="cursor:pointer;">
           <option value="Any">Any (All formats)</option>
           <option value="On-campus">On-campus (Live)</option>
           <option value="Online">Online / Distance</option>
           <option value="Hybrid">Hybrid (Blended)</option>
        </select>
      </div>

      <div class="profile-field">
        <label class="profile-label">Intended Major</label>
        <select id="profileMajorSelect" class="profile-input" style="cursor:pointer;">
           <option value="">Undecided / Any</option>
        </select>
      </div>

      <div class="profile-field">
        <label class="profile-label">GPA (Percent)</label>
        <div class="profile-budget">
          <input id="gpaInput" class="profile-input" type="number" min="0" max="100" step="0.1" placeholder="e.g. 92" />
          <button id="saveGpaBtn" class="icon-btn profile-save-btn" title="Save GPA">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <span class="profile-unit">% (0 to 100)</span>
        </div>
        <div class="profile-hint">GPA is stored as percent and used in admission matching.</div>
      </div>

      <div class="profile-field">
        <label class="profile-label">Exams (list, optional)</label>
        
        <div class="profile-exam-form">
          <select id="examNameSelect" class="profile-input" style="cursor:pointer;">
             <option value="" disabled selected>Select Exam</option>
             <option value="IELTS">IELTS</option>
             <option value="TOEFL">TOEFL</option>
             <option value="SAT">SAT</option>
             <option value="ACT">ACT</option>
          </select>

          <input id="examScoreInput" class="profile-input" type="number" step="0.1" placeholder="Score" />
          <button id="addExamBtn" class="profile-add" type="button">Add</button>
        </div>
        
        <div id="examError" class="profile-error"></div>
        <div id="examList" class="profile-exam-list"></div>
      </div>

      <section class="profile-block" id="languagesBlock">
        <div class="profile-block-head">
            <h3>Languages</h3>
        </div>

        <div class="lang-add-grid lang-add-grid--compact">
            <div>
            <span class="mini-label">Language</span>
            <select id="langCode" class="profile-input"></select>
            </div>

            <div>
            <span class="mini-label">Type</span>
            <select id="langKind" class="profile-input"></select>
            </div>

            <div id="cefrContainer" style="display:none">
            <span class="mini-label">CEFR</span>
            <select id="langCefr" class="profile-input">
                <option value="1">A1</option>
                <option value="2">A2</option>
                <option value="3">B1</option>
                <option value="4">B2</option>
                <option value="5">C1</option>
                <option value="6">C2</option>
            </select>
            </div>

            <div id="examContainer" style="display:none">
            <span class="mini-label">Exam</span>
            <select id="langExam" class="profile-input"></select>
            </div>

            <div id="scoreContainer" style="display:none">
            <span class="mini-label">Score</span>
            <input id="langExamScore"
                    type="text"
                    inputmode="decimal"
                    class="profile-input"
                    placeholder="Score (e.g. 7.5)" />
            </div>

            <button id="langAddBtn" class="profile-add" type="button">Add</button>
        </div>

        <div id="langList" class="lang-list"></div>
        </section>

  </div>
</div>

<div id="toast-container" class="toast-container"></div>
`;

// 🔥 1. Функция загрузки (теперь берет строку, а не файл)
export async function loadGlobalLayout() {
    if (document.getElementById("profileModal")) return;
    try {
        console.log("Injecting Layout HTML...");
        // Вставляем HTML из переменной
        document.body.insertAdjacentHTML('afterbegin', LAYOUT_HTML);
        syncNavbarLogo();
        bindThemeUiSync();

        // Подсветка активной ссылки в меню
        const currentPage = document.body.getAttribute('data-page');
        if (currentPage) {
            const activeLink = document.querySelector(`.navbar-center a[data-link="${currentPage}"]`) || 
                               document.querySelector(`.navbar-center a[href*="${currentPage}"]`);
            if (activeLink) {
                activeLink.style.color = "var(--accent)";
            }
        }

        // Запускаем логику профиля
        initProfileUI();

    } catch (error) {
        console.error("Error loading layout:", error);
    }
}

let __profileInited = false;
// 🔥 2. Логика профиля
function initProfileUI() {
    if (__profileInited) return;   // ✅ не инициализируем 2 раза
    __profileInited = true;
    const modal = document.getElementById("profileModal");
    if (!modal) {
        console.error("❌ initProfileUI: Modal not found in DOM!");
        return;
    }

    modal.setAttribute("aria-hidden", "true");

    if (modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";

    const openBtn = document.getElementById("profileBtn");
    const closeBtn = document.getElementById("profileCloseBtn");
    const backdrop = modal.querySelector(".profile-backdrop");
    
    const nameInput = document.getElementById("profileNameInput");
    const budgetInput = document.getElementById("budgetInput");
    const gpaInput = document.getElementById("gpaInput");
    const nameDisplay = document.getElementById("profileNameDisplay");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    
    const examNameSelect = document.getElementById("examNameSelect");
    const studyModeSelect = document.getElementById("studyModeSelect");
    const examScoreInput = document.getElementById("examScoreInput");
    const addExamBtn = document.getElementById("addExamBtn");
    const examList = document.getElementById("examList");
    const profileMajorSelect = document.getElementById("profileMajorSelect");

    const editNameBtn = document.getElementById("editNameBtn");
    const saveBudgetBtn = document.getElementById("saveBudgetBtn"); 
    const saveGpaBtn = document.getElementById("saveGpaBtn");
    const profileUsernameDiv = document.querySelector(".profile-username");

    const syncThemeButton = () => {
        if (!themeToggleBtn) return;
        const theme = getCurrentTheme();
        const nextTheme = theme === "dark" ? "light" : "dark";
        themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
        themeToggleBtn.title = `Switch to ${nextTheme} theme`;
        themeToggleBtn.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
        syncNavbarLogo(theme);
    };
    syncThemeButton();
    themeToggleBtn?.addEventListener("click", () => {
        toggleTheme();
        syncThemeButton();
    });
    window.addEventListener("themeChanged", (e) => {
        const theme = e?.detail?.theme || "";
        syncNavbarLogo(theme);
        syncThemeButton();
    });
    window.addEventListener("pageshow", () => {
        syncNavbarLogo();
        syncThemeButton();
    });
    
    let profile = loadProfile(); 

    const populateMajors = () => {
        if (!profileMajorSelect) return;
        profileMajorSelect.innerHTML = `<option value="">Undecided / Any</option>`;
        MAJOR_OPTIONS.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            profileMajorSelect.appendChild(opt);
        });
    };
    populateMajors();

    // --- ЛОГИКА 2: Динамические экзамены ---
    const populateExamSelect = () => {
        if (!examNameSelect) return;
        examNameSelect.innerHTML = `<option value="" disabled selected>Select Exam</option>`;
        
        Object.keys(EXAM_CONFIG).forEach(examKey => {
            if (String(examKey).toUpperCase() === "GPA") return;
            const opt = document.createElement("option");
            opt.value = examKey;
            opt.textContent = getExamDisplayName(examKey);
            examNameSelect.appendChild(opt);
        });
        
        // Обновляем кастомный селект, если он есть
        if (typeof initCustomSelect === "function") initCustomSelect("examNameSelect");
    };

    if (Object.keys(EXAM_CONFIG).length > 0) {
        populateExamSelect();
    }

    window.addEventListener("examConfigLoaded", populateExamSelect);

    const resetFields = () => {
        profile = loadProfile(); 
        if(nameInput) nameInput.value = profile.name;
        if(nameDisplay) nameDisplay.textContent = profile.name;
        if(budgetInput) budgetInput.value = profile.budget || "";
        if(gpaInput) gpaInput.value = (profile.gpa === "" || profile.gpa === null || profile.gpa === undefined) ? "" : String(profile.gpa);
        if(profileUsernameDiv) profileUsernameDiv.classList.remove("is-editing");
        if (studyModeSelect) studyModeSelect.value = profile.studyMode || "Any";
        if (profileMajorSelect) profileMajorSelect.value = profile.major || "";
        renderProfileData();
    };

    if (profileMajorSelect) {
        profileMajorSelect.addEventListener("change", () => {
            profile.major = profileMajorSelect.value;
            saveProfile(profile);
        });
    }

    if (studyModeSelect) {
        studyModeSelect.addEventListener("change", () => {
            profile.studyMode = studyModeSelect.value;
            saveProfile(profile);
            showToast("Preference saved", "success"); // Можно без тоста, чтобы не спамить
        });
    }

    if (openBtn) openBtn.onclick = () => { 
        resetFields();
        window.dispatchEvent(new Event("profileModalOpened"));
        modal.classList.add("is-open"); 
        modal.style.display = "flex";
        modal.removeAttribute("aria-hidden");
        
        // Инициализируем стиль для ВСЕХ селектов в профиле
        if (typeof initCustomSelect === "function") {
            initCustomSelect("examNameSelect");
            initCustomSelect("studyModeSelect");    // <--- ДОБАВЛЕНО
            initCustomSelect("profileMajorSelect"); // <--- ДОБАВЛЕНО
        }
    };
    
    const close = () => { 
        // 1. Сначала возвращаем фокус на кнопку открытия (чтобы не было ошибки aria-hidden)
        if (openBtn) openBtn.focus();

        // 2. Затем скрываем окно
        modal.classList.remove("is-open"); 
        modal.style.display = "none"; 
        modal.setAttribute("aria-hidden", "true");
        
        resetFields(); 
    };
    
    if (closeBtn) closeBtn.onclick = close;
    if (backdrop) backdrop.onclick = close;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    // Редактирование имени
    if (editNameBtn && profileUsernameDiv) {
        editNameBtn.onclick = () => {
            const isEditing = profileUsernameDiv.classList.contains("is-editing");
            if (!isEditing) {
                profileUsernameDiv.classList.add("is-editing");
                nameInput.focus();
            } else {
                const newName = nameInput.value.trim();
                const validName = /^[A-Za-z0-9 ]+$/;
                if (newName.length < 3 || newName.length > 16) {
                    showToast("Name length must be 3-16 chars", "error");
                    return;
                }
                if (!validName.test(newName)) {
                    showToast("Invalid symbols in name", "error");
                    return;
                }
                profile.name = newName;
                saveProfile(profile);
                nameDisplay.textContent = newName;
                profileUsernameDiv.classList.remove("is-editing");
                showToast("Nickname updated!", "success");
            }
        };
    }

    // Сохранение бюджета
    if (saveBudgetBtn) {
        saveBudgetBtn.onclick = () => {
            const rawVal = budgetInput.value;
            if (!rawVal) {
                profile.budget = "";
                saveProfile(profile);
                showToast("Budget cleared", "success");
                return;
            }
            if (rawVal.includes(".") || rawVal.includes(",")) {
                showToast("Integers only (no dots/commas)", "error");
                return;
            }
            const val = Number(rawVal);
            if (isNaN(val)) {
                showToast("Budget must be a number", "error");
                return;
            }
            if (val < 1 || val > 1000000) {
                showToast("Limit: 1 - 1,000,000 USD", "error");
                return;
            }
            profile.budget = val;
            saveProfile(profile);
            showToast("Budget saved!", "success");
        };
    }

    if (saveGpaBtn) {
        saveGpaBtn.onclick = () => {
            const rawVal = (gpaInput?.value || "").trim();
            if (!rawVal) {
                profile.gpa = "";
                saveProfile(profile);
                showToast("GPA cleared", "success");
                return;
            }

            const val = Number(rawVal);
            if (!Number.isFinite(val)) {
                showToast("GPA must be a number", "error");
                return;
            }

            const cfg = EXAM_CONFIG?.GPA || { min: 0, max: 100, step: 1 };
            const min = Number.isFinite(Number(cfg?.min)) ? Number(cfg.min) : 0;
            const max = Number.isFinite(Number(cfg?.max)) ? Number(cfg.max) : 100;
            const step = Number.isFinite(Number(cfg?.step)) ? Number(cfg.step) : 1;

            if (val < min || val > max) {
                showToast(`GPA must be between ${min} and ${max}%`, "error");
                return;
            }
            if (step > 0) {
                const k = (val - min) / step;
                if (Math.abs(k - Math.round(k)) > 1e-9) {
                    showToast(`GPA must use step ${step}`, "error");
                    return;
                }
            }

            profile.gpa = Number((Math.round(val * 1000) / 1000));
            saveProfile(profile);
            if (gpaInput) gpaInput.value = String(profile.gpa);
            showToast("GPA saved", "success");
        };
    }

    // 🔥 ЛОГИКА ДОБАВЛЕНИЯ / ОБНОВЛЕНИЯ ЭКЗАМЕНА
    if (addExamBtn) {
        addExamBtn.onclick = async () => {
            const name = examNameSelect.value;
            const rawScore = examScoreInput.value;
            const score = parseFloat(rawScore);

            const cfg = EXAM_CONFIG?.[name];
            if (cfg) {
            const min = (cfg.min !== undefined) ? Number(cfg.min) : null;
            const max = (cfg.max !== undefined) ? Number(cfg.max) : null;
            const step = (cfg.step !== undefined) ? Number(cfg.step) : null;

            if (Number.isFinite(min) && score < min) { showToast(`Min for ${name} is ${min}`, "error"); return; }
            if (Number.isFinite(max) && score > max) { showToast(`Max for ${name} is ${max}`, "error"); return; }

            if (Number.isFinite(step) && step > 0) {
                const base = Number.isFinite(min) ? min : 0;
                const k = (score - base) / step;
                const diff = Math.abs(k - Math.round(k));
                if (diff > 1e-9) {
                showToast(`${name} score must use step ${step}`, "error");
                return;
                }
            }
            }


            if (!name) {
                showToast("Please select an exam", "error");
                return;
            }
            if (isNaN(score)) {
                showToast("Invalid score format", "error");
                return;
            }

            // 1. Проверка на целые числа (кроме IELTS)
            if (name !== "IELTS") {
                if (!Number.isInteger(score)) {
                    showToast(`${name} score must be an integer (e.g. 1400)`, "error");
                    return;
                }
            }

            // 2. Проверка IELTS (шаг 0.5)
            if (name === "IELTS") {
                if (score % 0.5 !== 0) {
                    showToast("IELTS score must end with .0 or .5", "error");
                    return;
                }
            }

            // 3. Отправка на сервер и сохранение
            try {
                const res = await fetch(`${API_BASE}/exams/validate`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ exam: name, score: score })
                });
                const json = await res.json();
                
                if(!res.ok) throw new Error(json.detail || "Error");
                
                // 🔥 НОВАЯ ЛОГИКА: Ищем дубликат
                const examId = (json.exam ?? json.id);
                const examLabel = getExamDisplayName(examId);
                const existingIndex = profile.exams.findIndex(e => e.exam === examId);

                if (existingIndex !== -1) {
                profile.exams[existingIndex].score = json.score;
                showToast(`Updated ${examLabel} to ${json.score}`, "success");
                } else {
                profile.exams.push({ exam: examId, score: json.score });
                showToast(`Added ${examLabel}`, "success");
                }

                
                saveProfile(profile);
                renderProfileData();
                
                // Сброс полей
                examScoreInput.value = "";
                examNameSelect.value = ""; 
                // Обновляем красивый селект (сбрасываем выбор)
                if (typeof initCustomSelect === "function") {
                    initCustomSelect("examNameSelect");
                }

            } catch(e) {
                showToast(e.message, "error");
            }
        };
    }

    if (examList) {
        examList.onclick = (e) => {
            if (e.target.tagName === "BUTTON") {
                const idx = e.target.dataset.idx;
                profile.exams.splice(idx, 1);
                saveProfile(profile);
                renderProfileData();
                showToast("Exam removed", "success");
            }
        };
    }

    function renderProfileData() {
        if(examList) {
            examList.innerHTML = profile.exams.map((ex, i) => `
                <div class="profile-exam-item">
                    <div class="profile-exam-meta">
                        <span class="profile-exam-name">${escapeHtml(getExamDisplayName(ex.exam))}</span>
                        <span class="profile-exam-score">Score: ${escapeHtml(String(ex.score))}</span>
                    </div>
                    <button data-idx="${i}" class="profile-delete">Delete</button>
                </div>
            `).join("");
        }
    }
}

// Вспомогательная функция для табов
export function setupTabs() {
  const buttons = document.querySelectorAll(".d-tab-btn");
  const panes = document.querySelectorAll(".d-tab-pane");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}
