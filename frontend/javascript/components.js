/* 2. components.js - Элементы интерфейса */

function initProfileUI() {
  const modal = $("profileModal");
  if (!modal) return;

  const openBtn = $("profileBtn");
  const closeBtn = $("profileCloseBtn");
  
  const nameInput = $("profileNameInput");
  const budgetInput = $("budgetInput");
  const nameDisplay = $("profileNameDisplay");
  
  const examNameInput = $("examNameInput");
  const examScoreInput = $("examScoreInput");
  const addExamBtn = $("addExamBtn");
  const examList = $("examList");
  const examError = $("examError");

  // Кнопка редактирования имени
  const editNameBtn = $("editNameBtn");
  const profileUsernameDiv = document.querySelector(".profile-username");

  let profile = loadProfile();
  renderProfileData();

  if (openBtn) openBtn.onclick = () => { modal.classList.add("is-open"); modal.style.display="flex"; };
  
  const close = () => { modal.classList.remove("is-open"); modal.style.display="none"; };
  if (closeBtn) closeBtn.onclick = close;
  
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Логика смены имени
  if (editNameBtn && profileUsernameDiv) {
      editNameBtn.onclick = () => {
          profileUsernameDiv.classList.toggle("is-editing");
          if (profileUsernameDiv.classList.contains("is-editing") && nameInput) {
              nameInput.focus();
          }
      };
  }

  if (nameInput) {
      nameInput.oninput = (e) => {
          profile.name = e.target.value;
          saveProfile(profile);
          if(nameDisplay) nameDisplay.textContent = profile.name;
      };
  }

  if (budgetInput) {
      budgetInput.oninput = (e) => {
          profile.budget = e.target.value;
          saveProfile(profile);
      };
  }

  if (addExamBtn) {
      addExamBtn.onclick = async () => {
          if(examError) examError.textContent = "";
          const name = examNameInput.value.trim();
          const score = parseFloat(examScoreInput.value);

          if (!name || isNaN(score)) {
              if(examError) examError.textContent = "Invalid input";
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
             
             examNameInput.value = "";
             examScoreInput.value = "";

          } catch(e) {
              if(examError) examError.textContent = e.message;
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
          }
      };
  }

  function renderProfileData() {
      if(nameInput) nameInput.value = profile.name;
      if(nameDisplay) nameDisplay.textContent = profile.name;
      if(budgetInput) budgetInput.value = profile.budget;
      
      if(examList) {
          examList.innerHTML = profile.exams.map((ex, i) => `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; background:#f9f9f9; padding:5px;">
                <span><b>${ex.exam}</b>: ${ex.score}</span>
                <button data-idx="${i}" style="color:red; border:none; background:none; cursor:pointer;">X</button>
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