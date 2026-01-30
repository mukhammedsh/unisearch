async function loadGlobalLayout() {
    try {
        // Добавляем ?v=Date.now(), чтобы браузер всегда брал свежую версию файла
        const response = await fetch(`layoutnew.html?v=${Date.now()}`);
        if (!response.ok) throw new Error("Failed to load layout");
        
        const html = await response.text();
        
        // Вставляем HTML в самое начало body
        document.body.insertAdjacentHTML('afterbegin', html);

        // Подсветка активной ссылки в меню
        const currentPage = document.body.getAttribute('data-page');
        if (currentPage) {
            const activeLink = document.querySelector(`.navbar-center a[data-link="${currentPage}"]`) || 
                               document.querySelector(`.navbar-center a[href*="${currentPage}"]`);
            if (activeLink) {
                activeLink.style.color = "#5d17ea";
            }
        }

        // Запускаем логику профиля только ПОСЛЕ того, как HTML появился на странице
        initProfileUI();

    } catch (error) {
        console.error("Error loading layout:", error);
    }
}
/* 2. components.js - Элементы интерфейса */

function initProfileUI() {
  const modal = $("profileModal");
  if (!modal) return;

  const openBtn = $("profileBtn");
  const closeBtn = $("profileCloseBtn");
  const backdrop = modal.querySelector(".profile-backdrop"); // Для клика по фону
  
  const nameInput = $("profileNameInput");
  const budgetInput = $("budgetInput");
  const nameDisplay = $("profileNameDisplay");
  
  const examNameInput = $("examNameInput");
  const examScoreInput = $("examScoreInput");
  const addExamBtn = $("addExamBtn");
  const examList = $("examList");
  
  // Кнопки управления
  const editNameBtn = $("editNameBtn");
  const saveBudgetBtn = $("saveBudgetBtn"); // Новая кнопка
  const profileUsernameDiv = document.querySelector(".profile-username");

  let profile = loadProfile(); // Текущий сохраненный профиль
  
  // Функция сброса полей (если закрыли без сохранения)
  const resetFields = () => {
      profile = loadProfile(); // Перезагружаем из памяти
      if(nameInput) nameInput.value = profile.name;
      if(nameDisplay) nameDisplay.textContent = profile.name;
      if(budgetInput) budgetInput.value = profile.budget || "";
      
      // Сбрасываем режим редактирования имени
      if(profileUsernameDiv) profileUsernameDiv.classList.remove("is-editing");
      
      renderProfileData();
  };

  // Открытие
  if (openBtn) openBtn.onclick = () => { 
      resetFields(); // Заполняем поля актуальными данными
      modal.classList.add("is-open"); 
      modal.style.display="flex"; 
  };
  
  // Закрытие
  const close = () => { 
      modal.classList.remove("is-open"); 
      modal.style.display="none"; 
      resetFields(); // Сбрасываем несохраненные изменения
  };
  
  if (closeBtn) closeBtn.onclick = close;
  if (backdrop) backdrop.onclick = close;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // --- ЛОГИКА 1: Редактирование имени ---
  if (editNameBtn && profileUsernameDiv) {
      editNameBtn.onclick = () => {
          const isEditing = profileUsernameDiv.classList.contains("is-editing");

          if (!isEditing) {
              // Входим в режим редактирования
              profileUsernameDiv.classList.add("is-editing");
              nameInput.focus();
          } else {
              // Попытка сохранить
              const newName = nameInput.value.trim();
              
              // Валидация имени
              const validName = /^[A-Za-z0-9 ]+$/;
              if (newName.length < 3 || newName.length > 12) {
                  showToast("Name length must be 3-12 chars", "error");
                  return;
              }
              if (!validName.test(newName)) {
                  showToast("Invalid symbols in name", "error");
                  return;
              }

              // Успех
              profile.name = newName;
              saveProfile(profile);
              nameDisplay.textContent = newName;
              profileUsernameDiv.classList.remove("is-editing");
              showToast("Nickname updated!", "success");
          }
      };
  }

  // --- ЛОГИКА 2: Сохранение бюджета ---
  if (saveBudgetBtn) {
      saveBudgetBtn.onclick = () => {
          const rawVal = budgetInput.value;
          
          // Проверка на пустоту (разрешаем сброс)
          if (!rawVal) {
              profile.budget = "";
              saveProfile(profile);
              showToast("Budget cleared", "success");
              return;
          }

          // Проверка на точку/запятую (дробные числа)
          if (rawVal.includes(".") || rawVal.includes(",")) {
              showToast("Integers only (no dots/commas)", "error");
              return;
          }

          const val = Number(rawVal);

          // Проверка на число
          if (isNaN(val)) {
              showToast("Budget must be a number", "error");
              return;
          }

          // Проверка лимитов
          if (val < 1 || val > 1000000) {
              showToast("Limit: 1 - 1,000,000 USD", "error");
              return;
          }

          // Успех
          profile.budget = val;
          saveProfile(profile);
          showToast("Budget saved!", "success");
      };
  }

  // --- ЛОГИКА 3: Экзамены (тут можно оставить авто-сохранение или переделать, оставил как было для простоты UX) ---
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
             saveProfile(profile); // Экзамены сохраняем сразу
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
      // Имя и бюджет просто отображаем текущие (из переменной profile или input)
      // Список экзаменов:
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