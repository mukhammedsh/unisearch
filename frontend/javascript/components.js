/* 2. components.js - Элементы интерфейса */

// HTML-код меню и профиля (вшит прямо сюда, чтобы избежать проблем с загрузкой файлов)
const LAYOUT_HTML = `
<header class="navbar">
  <div class="navbar-left">
    <a href="index.html" style="display: flex; align-items: center;">
      <img src="images/logo.jpeg" alt="Logo" class="logo" />
    </a>
  </div>

  <nav class="navbar-center">
    <a href="index.html" data-link="home">Home</a>
    <a href="universities.html" data-link="universities">Universities</a>
    <a href="ranking.html" data-link="ranking">Rankings</a>
  </nav>

  <div class="navbar-right">
    <button class="login-btn" id="profileBtn">Profile</button>
  </div>
</header>

<div class="profile-modal" id="profileModal" aria-hidden="true">
  <div class="profile-backdrop" data-close="profile"></div>
  <div class="profile-card" role="dialog">
    <div class="profile-header">
      <div class="profile-title">
        <div class="profile-username">
          <span id="profileNameDisplay">User</span>
          <input id="profileNameInput" class="profile-name-input" type="text" value="User" minlength="3" maxlength="12" />
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
        <label class="profile-label">Exams (list, optional)</label>
        <div class="profile-exam-form">
          <input id="examNameInput" class="profile-input" type="text" placeholder="IELTS..." />
          <input id="examScoreInput" class="profile-input" type="number" step="0.1" placeholder="Score" />
          <button id="addExamBtn" class="profile-add">Add</button>
        </div>
        <div id="examError" class="profile-error"></div>
        <div id="examList" class="profile-exam-list"></div>
      </div>
    </div>
  </div>
</div>

<div id="toast-container" class="toast-container"></div>
`;

// 🔥 1. Функция загрузки (теперь берет строку, а не файл)
async function loadGlobalLayout() {
    try {
        console.log("Injecting Layout HTML...");
        // Вставляем HTML из переменной
        document.body.insertAdjacentHTML('afterbegin', LAYOUT_HTML);

        // Подсветка активной ссылки в меню
        const currentPage = document.body.getAttribute('data-page');
        if (currentPage) {
            const activeLink = document.querySelector(`.navbar-center a[data-link="${currentPage}"]`) || 
                               document.querySelector(`.navbar-center a[href*="${currentPage}"]`);
            if (activeLink) {
                activeLink.style.color = "#5d17ea";
            }
        }

        // Запускаем логику профиля
        initProfileUI();

    } catch (error) {
        console.error("Error loading layout:", error);
    }
}

// 🔥 2. Логика профиля
function initProfileUI() {
  const modal = document.getElementById("profileModal");
  if (!modal) {
      console.error("❌ initProfileUI: Modal not found in DOM!");
      return;
  }

  const openBtn = document.getElementById("profileBtn");
  const closeBtn = document.getElementById("profileCloseBtn");
  const backdrop = modal.querySelector(".profile-backdrop");
  
  const nameInput = document.getElementById("profileNameInput");
  const budgetInput = document.getElementById("budgetInput");
  const nameDisplay = document.getElementById("profileNameDisplay");
  
  const examNameInput = document.getElementById("examNameInput");
  const examScoreInput = document.getElementById("examScoreInput");
  const addExamBtn = document.getElementById("addExamBtn");
  const examList = document.getElementById("examList");
  
  const editNameBtn = document.getElementById("editNameBtn");
  const saveBudgetBtn = document.getElementById("saveBudgetBtn"); 
  const profileUsernameDiv = document.querySelector(".profile-username");

  let profile = loadProfile(); 
  
  const resetFields = () => {
      profile = loadProfile(); 
      if(nameInput) nameInput.value = profile.name;
      if(nameDisplay) nameDisplay.textContent = profile.name;
      if(budgetInput) budgetInput.value = profile.budget || "";
      if(profileUsernameDiv) profileUsernameDiv.classList.remove("is-editing");
      renderProfileData();
  };

  if (openBtn) openBtn.onclick = () => { 
      resetFields(); 
      modal.classList.add("is-open"); 
      modal.style.display = "flex"; 
  };
  
  const close = () => { 
      modal.classList.remove("is-open"); 
      modal.style.display = "none"; 
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
              if (newName.length < 3 || newName.length > 12) {
                  showToast("Name length must be 3-12 chars", "error");
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

  // Добавление экзамена
  if (addExamBtn) {
      addExamBtn.onclick = async () => {
          const name = examNameInput.value.trim();
          const score = parseFloat(examScoreInput.value);

          if (!name || isNaN(score)) {
              showToast("Invalid exam data", "error");
              return;
          }

          try {
             const res = await fetch(`${API_BASE}/exams/validate`, {
                 method: "POST",
                 headers: {"Content-Type": "application/json"},
                 body: JSON.stringify({ exam: name, score: score })
             });
             const json = await res.json();
             
             if(!res.ok) throw new Error(json.detail || "Error");
             
             profile.exams.push({ exam: json.exam, score: json.score });
             saveProfile(profile);
             renderProfileData();
             showToast(`Added ${json.exam}`, "success");
             
             examNameInput.value = "";
             examScoreInput.value = "";

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
                    <span class="profile-exam-name">${ex.exam}</span>
                    <span class="profile-exam-score">Score: ${ex.score}</span>
                </div>
                <button data-idx="${i}" class="profile-delete">Delete</button>
            </div>
          `).join("");
      }
  }
}

// Вспомогательная функция для табов
function setupTabs() {
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