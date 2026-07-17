// Local aliases for global variables and services loaded sequentially
var translateLocally = window.translateLocally;
var translateWithGemini = window.translateWithGemini;
var splitIngredients = window.splitIngredients;
var eNumbersRegistry = window.eNumbersRegistry;
var lookupIngredient = window.lookupIngredient;

// === LOCAL STORAGE HELPERS ===
function safeGetLocalStorage(key, defaultValue) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch (e) {
    console.warn("localStorage is not accessible:", e);
    return defaultValue;
  }
}

function safeGetLocalStorageJSON(key, defaultValue) {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    const parsed = JSON.parse(val);
    return Array.isArray(defaultValue) && !Array.isArray(parsed) ? defaultValue : parsed;
  } catch (e) {
    console.warn("localStorage is not accessible or invalid JSON:", e);
    return defaultValue;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("Failed to write to localStorage:", e);
  }
}

// === GLOBAL STATE ===
const state = {
  apiKey: safeGetLocalStorage("foodlabel_api_key", ""),
  useAI: safeGetLocalStorage("foodlabel_use_ai", "false") === "true",
  selectedModel: safeGetLocalStorage("foodlabel_model", "gemini-2.5-flash"),
  activeTab: "dashboard",
  currentIngredients: [],
  currentContainsAllergens: [],
  currentMayContainAllergens: [],
  history: safeGetLocalStorageJSON("foodlabel_history", []),
  theme: safeGetLocalStorage("foodlabel_theme", "dark")
};

// === DOM SELECTORS ===
const elements = {
  // Navigation
  menuDashboard: document.getElementById("menu-dashboard"),
  menuDatabase: document.getElementById("menu-database"),
  menuHistory: document.getElementById("menu-history"),
  menuSettingsBtn: document.getElementById("menu-settings-btn"),
  pageHeaderTitle: document.getElementById("page-header-title"),
  
  // Mobile Navigation
  mobileMenuDashboard: document.getElementById("mobile-menu-dashboard"),
  mobileMenuDatabase: document.getElementById("mobile-menu-database"),
  mobileMenuHistory: document.getElementById("mobile-menu-history"),
  mobileMenuSettings: document.getElementById("mobile-menu-settings"),
  mobileThemeToggle: document.getElementById("mobile-theme-toggle"),
  
  // Views
  sectionDashboard: document.getElementById("section-dashboard"),
  sectionDatabase: document.getElementById("section-database"),
  sectionHistory: document.getElementById("section-history"),
  
  // Dashboard Panel elements
  rawIngredientsInput: document.getElementById("raw-ingredients-input"),
  hebrewIngredientsOutput: document.getElementById("hebrew-ingredients-output"),
  rawCharCount: document.getElementById("raw-char-count"),
  hebrewCharCount: document.getElementById("hebrew-char-count"),
  clearInputBtn: document.getElementById("clear-input-btn"),
  translateBtn: document.getElementById("translate-btn"),
  apiStatusBadge: document.getElementById("api-status-badge"),
  resultsTableSection: document.getElementById("results-table-section"),
  ingredientsTableBody: document.getElementById("ingredients-table-body"),
  copyHebrewBtn: document.getElementById("copy-hebrew-btn"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  saveHistoryBtn: document.getElementById("save-history-btn"),
  
  // CoT HUD
  progressHud: document.getElementById("translation-progress-hud"),
  progressMsg: document.getElementById("progress-status-msg"),
  progressPercent: document.getElementById("progress-percent"),
  progressBarFill: document.getElementById("progress-bar-fill"),
  dashboardActionButtons: document.getElementById("dashboard-action-buttons"),
  
  // Settings Dialog
  settingsOverlay: document.getElementById("settings-overlay-box"),
  settingsCloseBtn: document.getElementById("settings-close-btn"),
  settingsCancelBtn: document.getElementById("settings-cancel-btn"),
  settingsSaveBtn: document.getElementById("settings-save-btn"),
  translationModeSwitch: document.getElementById("translation-mode-switch"),
  apiKeyInput: document.getElementById("api-key-input"),
  apiKeyFormGroup: document.getElementById("api-key-form-group"),
  apiModelSelect: document.getElementById("api-model-select"),
  
  // Tooltip Modal
  tooltipBackdrop: document.getElementById("tooltip-backdrop-overlay"),
  tooltipModal: document.getElementById("tooltip-modal-box"),
  tooltipCloseBtn: document.getElementById("tooltip-close-btn"),
  tooltipTitle: document.getElementById("tooltip-modal-title"),
  tooltipHeName: document.getElementById("tooltip-he-name"),
  tooltipEnName: document.getElementById("tooltip-en-name"),
  tooltipRoleName: document.getElementById("tooltip-role-name"),
  tooltipDescContent: document.getElementById("tooltip-desc-content"),
  
  // Search Database
  dbSearchInput: document.getElementById("db-search-input"),
  dbCardsGrid: document.getElementById("db-cards-grid"),
  
  // History Page
  historyItemsGrid: document.getElementById("history-items-grid"),
  sidebarHistoryList: document.getElementById("sidebar-history-list"),
  
  // Toast Popup
  toast: document.getElementById("app-toast-box"),
  
  // Theme Toggles
  themeDarkBtn: document.getElementById("theme-dark-btn"),
  themeLightBtn: document.getElementById("theme-light-btn")
};

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSettings();
  initNavigation();
  initHistory();
  initDatabaseView();
  initEventListeners();
  updateApiStatusUI();
});

// === THEME MANAGER ===
function updateMobileThemeIcon() {
  if (!elements.mobileThemeToggle) return;
  const darkIcon = elements.mobileThemeToggle.querySelector(".theme-icon-dark");
  const lightIcon = elements.mobileThemeToggle.querySelector(".theme-icon-light");
  
  if (state.theme === "dark") {
    if (darkIcon) darkIcon.style.display = "none";
    if (lightIcon) lightIcon.style.display = "block";
  } else {
    if (darkIcon) darkIcon.style.display = "block";
    if (lightIcon) lightIcon.style.display = "none";
  }
}

function initTheme() {
  if (state.theme === "light") {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
  } else {
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");
  }
  updateMobileThemeIcon();
}

function setTheme(themeName) {
  state.theme = themeName;
  safeSetLocalStorage("foodlabel_theme", themeName);
  initTheme();
  showToast(`Theme switched to ${themeName === "dark" ? "Dark Mode" : "Light Mode"}`);
}

// === SETTINGS MANAGER ===
function initSettings() {
  // Populate settings fields from state
  elements.translationModeSwitch.checked = state.useAI;
  elements.apiKeyInput.value = state.apiKey;
  elements.apiModelSelect.value = state.selectedModel;
  
  // Toggle Gemini API Input field view depending on AI mode selection
  toggleApiKeyField(state.useAI);
}

function toggleApiKeyField(show) {
  if (show) {
    elements.apiKeyFormGroup.style.display = "flex";
  } else {
    elements.apiKeyFormGroup.style.display = "none";
  }
}

function saveSettings() {
  const useAI = elements.translationModeSwitch.checked;
  const apiKey = elements.apiKeyInput.value.trim();
  const model = elements.apiModelSelect.value;
  
  if (useAI && !apiKey) {
    showToast("Please enter an API key to use Gemini!");
    return;
  }
  
  state.useAI = useAI;
  state.apiKey = apiKey;
  state.selectedModel = model;
  
  safeSetLocalStorage("foodlabel_use_ai", useAI);
  safeSetLocalStorage("foodlabel_api_key", apiKey);
  safeSetLocalStorage("foodlabel_model", model);
  
  updateApiStatusUI();
  closeSettingsOverlay();
  showToast("Settings saved successfully!");
}

function updateApiStatusUI() {
  if (state.useAI && state.apiKey) {
    elements.apiStatusBadge.textContent = `Gemini Active (${state.selectedModel})`;
    elements.apiStatusBadge.className = "badge badge-role";
    elements.apiStatusBadge.style.backgroundColor = "rgba(99, 102, 241, 0.15)";
    elements.apiStatusBadge.style.borderColor = "rgba(99, 102, 241, 0.3)";
    elements.apiStatusBadge.style.color = "var(--color-primary)";
  } else {
    elements.apiStatusBadge.textContent = "Demo Mode (Offline)";
    elements.apiStatusBadge.className = "badge badge-null";
    elements.apiStatusBadge.style.backgroundColor = "transparent";
    elements.apiStatusBadge.style.borderColor = "var(--card-border)";
    elements.apiStatusBadge.style.color = "var(--text-muted)";
  }
}

function openSettingsOverlay() {
  elements.settingsOverlay.classList.add("show");
}

function closeSettingsOverlay() {
  elements.settingsOverlay.classList.remove("show");
}

// === NAVIGATION MANAGER ===
function initNavigation() {
  const menuItems = [
    { el: elements.menuDashboard, tab: "dashboard", title: "Dashboard & Regulation" },
    { el: elements.menuDatabase, tab: "database", title: "E-Numbers Database" },
    { el: elements.menuHistory, tab: "history", title: "Translation History" }
  ];
  
  menuItems.forEach(item => {
    if (item.el) {
      item.el.addEventListener("click", () => {
        switchTab(item.tab, item.title);
      });
      item.el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchTab(item.tab, item.title);
        }
      });
    }
  });

  // Mobile bottom navigation buttons
  const mobileMenuItems = [
    { el: elements.mobileMenuDashboard, tab: "dashboard", title: "Dashboard & Regulation" },
    { el: elements.mobileMenuDatabase, tab: "database", title: "E-Numbers Database" },
    { el: elements.mobileMenuHistory, tab: "history", title: "Translation History" }
  ];

  mobileMenuItems.forEach(item => {
    if (item.el) {
      item.el.addEventListener("click", () => {
        switchTab(item.tab, item.title);
      });
    }
  });

  // Mobile settings navigation shortcut
  if (elements.mobileMenuSettings) {
    elements.mobileMenuSettings.addEventListener("click", () => {
      openSettingsOverlay();
    });
  }
}

function switchTab(tabName, title) {
  state.activeTab = tabName;
  elements.pageHeaderTitle.textContent = title;
  
  // Manage active classes (Desktop)
  [elements.menuDashboard, elements.menuDatabase, elements.menuHistory].forEach(el => {
    if (el) el.classList.remove("active");
  });
  
  if (tabName === "dashboard" && elements.menuDashboard) elements.menuDashboard.classList.add("active");
  if (tabName === "database" && elements.menuDatabase) elements.menuDatabase.classList.add("active");
  if (tabName === "history" && elements.menuHistory) elements.menuHistory.classList.add("active");
  
  // Manage active classes (Mobile)
  [elements.mobileMenuDashboard, elements.mobileMenuDatabase, elements.mobileMenuHistory].forEach(el => {
    if (el) el.classList.remove("active");
  });
  
  if (tabName === "dashboard" && elements.mobileMenuDashboard) elements.mobileMenuDashboard.classList.add("active");
  if (tabName === "database" && elements.mobileMenuDatabase) elements.mobileMenuDatabase.classList.add("active");
  if (tabName === "history" && elements.mobileMenuHistory) elements.mobileMenuHistory.classList.add("active");
  
  // Toggle sections
  elements.sectionDashboard.style.display = tabName === "dashboard" ? "block" : "none";
  elements.sectionDatabase.style.display = tabName === "database" ? "flex" : "none";
  elements.sectionHistory.style.display = tabName === "history" ? "flex" : "none";
}

// === DYNAMIC DETAILS POPUP (TOOLTIPS) ===
function showTooltip(eNumber) {
  const data = eNumbersRegistry[eNumber];
  if (!data) return;
  
  elements.tooltipTitle.textContent = eNumber;
  elements.tooltipHeName.textContent = data.hebrew_name;
  elements.tooltipEnName.textContent = data.english_name;
  elements.tooltipRoleName.textContent = data.role;
  elements.tooltipDescContent.textContent = data.details || "No details available in local registry.";
  
  elements.tooltipBackdrop.classList.add("show");
  elements.tooltipModal.classList.add("show");
}

function closeTooltip() {
  elements.tooltipBackdrop.classList.remove("show");
  elements.tooltipModal.classList.remove("show");
}

// === LOCAL DATABASE SEARCH VIEW ===
function initDatabaseView() {
  renderDatabaseCards("");
}

function renderDatabaseCards(query) {
  elements.dbCardsGrid.innerHTML = "";
  const q = query.trim().toLowerCase();
  
  let matchCount = 0;
  for (const [eNum, details] of Object.entries(eNumbersRegistry)) {
    const isMatch = eNum.toLowerCase().includes(q) || 
                    details.hebrew_name.toLowerCase().includes(q) || 
                    details.english_name.toLowerCase().includes(q) || 
                    details.role.toLowerCase().includes(q) ||
                    (details.details && details.details.toLowerCase().includes(q));
                    
    if (isMatch) {
      matchCount++;
      const card = document.createElement("div");
      card.className = "db-card";
      card.innerHTML = `
        <div class="db-card-header">
          <span class="db-card-title">${eNum}</span>
          <span class="badge badge-role" style="font-size: 0.7rem;">${details.role}</span>
        </div>
        <div class="db-card-body">
          <strong style="color: var(--text-main);">${details.english_name}</strong>
          <p style="margin-top: 6px; font-size: 0.8rem;">${details.details || ''}</p>
        </div>
        <div class="db-card-footer">${details.hebrew_name}</div>
      `;
      card.addEventListener("click", () => showTooltip(eNum));
      elements.dbCardsGrid.appendChild(card);
    }
  }
  
  if (matchCount === 0) {
    elements.dbCardsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No matching ingredients found in local registry.</div>`;
  }
}

// === TRANSLATION LOGIC (DASHBOARD) ===
async function handleTranslation() {
  const inputText = elements.rawIngredientsInput.value.trim();
  if (!inputText) {
    showToast("Please enter an ingredient list to translate!");
    return;
  }
  
  // Validate input looks like food ingredients
  const validation = validateIngredientInput(inputText);
  if (!validation.valid) {
    showToast(validation.message);
    return;
  }
  
  // Show Progress HUD
  elements.progressHud.style.display = "flex";
  elements.dashboardActionButtons.style.display = "none";
  updateProgress("Initializing translator...", 5);

  try {
    let result;
    if (state.useAI && state.apiKey) {
      result = await translateWithGemini(inputText, state.apiKey, state.selectedModel, (msg, pct) => {
        updateProgress(msg, pct);
      });
    } else {
      updateProgress("Parsing and mapping ingredients locally (Demo)...", 50);
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate loading
      result = translateLocally(inputText);
      updateProgress("Local translation completed successfully!", 100);
    }
    
    // Process Results
    if (result && Array.isArray(result.ingredients)) {
      state.currentIngredients = result.ingredients;
      state.currentContainsAllergens = result.contains_allergens || [];
      state.currentMayContainAllergens = result.may_contain_allergens || [];
      
      renderBreakdownTable();
      updateHebrewIngredientsOutput();
      elements.resultsTableSection.style.display = "block";
      showToast("Ingredients standardized successfully!");
    } else {
      throw new Error("Received malformed translation result.");
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || "Translation failed. Check network connection and API key.");
  } finally {
    // Hide Progress HUD after delay
    setTimeout(() => {
      elements.progressHud.style.display = "none";
      elements.dashboardActionButtons.style.display = "flex";
    }, 1000);
  }
}

function updateProgress(msg, pct) {
  elements.progressMsg.textContent = msg;
  elements.progressPercent.textContent = `${pct}%`;
  elements.progressBarFill.style.width = `${pct}%`;
}

// === RESULTS TABLE RENDER & EVENT HANDLERS ===
function renderBreakdownTable() {
  elements.ingredientsTableBody.innerHTML = "";
  
  if (state.currentIngredients.length === 0) {
    elements.ingredientsTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No translated ingredients to display</td></tr>`;
    return;
  }
  
  state.currentIngredients.forEach((ing, index) => {
    const row = document.createElement("tr");
    row.setAttribute("draggable", "true");
    row.dataset.index = index;
    
    // Build E-Number Badge
    let eBadge = `<span class="badge badge-null">None</span>`;
    if (ing.e_number) {
      eBadge = `<span class="badge badge-enum" data-enum="${ing.e_number}">${ing.e_number}</span>`;
    }
    
    // Build Role Badge
    let roleBadge = `<span class="badge badge-null">None</span>`;
    if (ing.role) {
      roleBadge = `<span class="badge badge-role">${ing.role}</span>`;
    }
    
    row.innerHTML = `
      <td class="col-drag">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
          <button class="row-actions-btn move-up-btn" title="הזז למעלה" style="padding: 2px;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" width="12" height="12">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button class="row-actions-btn move-down-btn" title="הזז למטה" style="padding: 2px;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" width="12" height="12">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </td>
      <td class="col-orig">
        <input type="text" class="editable-input orig-input" value="${escapeHtml(ing.original_text)}" style="direction: ltr; text-align: left;">
      </td>
      <td class="col-trans">
        <input type="text" class="editable-input trans-input" value="${escapeHtml(ing.translated_text)}">
      </td>
      <td class="col-enum">${eBadge}</td>
      <td class="col-role">${roleBadge}</td>
      <td class="col-actions">
        <button class="row-actions-btn delete-btn" title="מחק רכיב">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </td>
    `;
    
    // Add Event Listeners for Inline Editing
    const origInput = row.querySelector(".orig-input");
    const transInput = row.querySelector(".trans-input");
    
    origInput.addEventListener("change", (e) => {
      const idx = parseInt(row.dataset.index);
      const val = e.target.value.trim();
      state.currentIngredients[idx].original_text = val;
      
      // Auto mapping recalculation locally on original change
      const match = lookupIngredient(val);
      if (match) {
        state.currentIngredients[idx].translated_text = match.hebrew_name;
        state.currentIngredients[idx].e_number = match.e_number;
        state.currentIngredients[idx].role = match.role;
        state.currentIngredients[idx].details = match.details;
        renderBreakdownTable();
      }
      updateHebrewIngredientsOutput();
    });
    
    transInput.addEventListener("change", (e) => {
      const idx = parseInt(row.dataset.index);
      state.currentIngredients[idx].translated_text = e.target.value.trim();
      updateHebrewIngredientsOutput();
    });
    
    // E-number Click Event
    const enumBadge = row.querySelector(".badge-enum");
    if (enumBadge) {
      enumBadge.addEventListener("click", () => {
        showTooltip(enumBadge.dataset.enum);
      });
    }
    
    // Delete Event
    row.querySelector(".delete-btn").addEventListener("click", () => {
      const idx = parseInt(row.dataset.index);
      state.currentIngredients.splice(idx, 1);
      renderBreakdownTable();
      updateHebrewIngredientsOutput();
      showToast("Ingredient removed successfully");
    });
    
    // Move Up Event
    row.querySelector(".move-up-btn").addEventListener("click", () => {
      const idx = parseInt(row.dataset.index);
      if (idx > 0) {
        const temp = state.currentIngredients[idx];
        state.currentIngredients[idx] = state.currentIngredients[idx - 1];
        state.currentIngredients[idx - 1] = temp;
        renderBreakdownTable();
        updateHebrewIngredientsOutput();
      }
    });
    
    // Move Down Event
    row.querySelector(".move-down-btn").addEventListener("click", () => {
      const idx = parseInt(row.dataset.index);
      if (idx < state.currentIngredients.length - 1) {
        const temp = state.currentIngredients[idx];
        state.currentIngredients[idx] = state.currentIngredients[idx + 1];
        state.currentIngredients[idx + 1] = temp;
        renderBreakdownTable();
        updateHebrewIngredientsOutput();
      }
    });
    
    // HTML5 Drag and Drop Events
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", row.dataset.index);
      row.style.opacity = "0.5";
    });
    
    row.addEventListener("dragend", () => {
      row.style.opacity = "1";
      document.querySelectorAll("#ingredients-table-body tr").forEach(tr => {
        tr.classList.remove("drag-over");
      });
    });
    
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });
    
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });
    
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
      const toIndex = parseInt(row.dataset.index);
      
      if (fromIndex !== toIndex) {
        const draggedItem = state.currentIngredients[fromIndex];
        state.currentIngredients.splice(fromIndex, 1);
        state.currentIngredients.splice(toIndex, 0, draggedItem);
        renderBreakdownTable();
        updateHebrewIngredientsOutput();
      }
    });

    elements.ingredientsTableBody.appendChild(row);
  });
}

// Post-processing helper function for dynamic additive grouping in Hebrew
function groupHebrewAdditives(ingredients) {
  const groupedList = [];
  const groups = {};
  
  ingredients.forEach(ing => {
    if (ing.role && ing.role !== "null" && ing.role !== "None") {
      const role = ing.role.trim();
      const displayName = ing.translated_text && ing.translated_text !== "null" ? ing.translated_text : ing.original_text;
      
      let cleaned = displayName;
      if (role) {
        cleaned = displayName.replace(role, "").trim();
      }
      const wrapMatch = cleaned.match(/^\((.*)\)$/);
      let subText;
      if (wrapMatch) {
        subText = wrapMatch[1].trim();
      } else {
        subText = cleaned;
      }
      if (!subText) subText = displayName;
      
      if (!groups[role]) {
        groups[role] = [];
      }
      if (!groups[role].includes(subText)) {
        groups[role].push(subText);
      }
    }
  });
  
  const rolePlurals = {
    "חומר משמר": "חומרים משמרים",
    "מווסת חומציות": "מווסתי חומציות",
    "מתחלב": "מתחלבים",
    "מייצב": "מייצבים",
    "מסמיך": "מסמיכים",
    "מעבה": "מעבים",
    "מעבים": "מעבים",
    "מייצב ומסמיך": "מייצבים ומסמיכים",
    "חומר מתפיח": "חומרי התפחה",
    "חומר התפחה": "חומרי התפחה",
    "מתפיח ומווסת חומציות": "חומרי התפחה ומווסתי חומציות",
    "צבע מאכל": "צבעי מאכל",
    "מחזק טעם": "מחזקי טעם",
    "ממתיק": "ממתיקים",
    "ממתיק ולחלוח": "ממתיקים וחומרי לחלוח",
    "חומר מקריש ומייצב": "חומרים מקרישים ומייצבים",
    "מתחלב ומתפיח": "מתחלבים וחומרי התפחה",
    "חומר משמר ונוגד חמצון": "חומרים משמרים ונוגדי חמצון",
    "נוגד חמצון": "נוגדי חמצון",
    "עמילן מעובד": "עמילנים מעובדים",
    "חומר מונע התגיישות": "חומרים מונעי התגיישות",
    "חומר טעם וריח": "חומרי טעם וריח",
    "חומר טעם וריח טבעי": "חומרי טעם וריח טבעיים",
    "חומר טעם וריח סינתטי": "חומרי טעם וריח מלאכותיים",
    "חומר טעם וריח סינטטי": "חומרי טעם וריח מלאכותיים",
    "חומר טעם וריח מלאכותי": "חומרי טעם וריח מלאכותיים",
    "חומרי טעם וריח": "חומרי טעם וריח",
    "חומרי טעם וריח טבעיים": "חומרי טעם וריח טבעיים",
    "חומרי טעם וריח סינתטיים": "חומרי טעם וריח מלאכותיים",
    "חומרי טעם וריח סינטטיים": "חומרי טעם וריח מלאכותיים",
    "חומרי טעם וריח מלאכותיים": "חומרי טעם וריח מלאכותיים"
  };
  
  const roleOrder = [];
  ingredients.forEach(ing => {
    if (ing.role && ing.role !== "null" && ing.role !== "None") {
      const role = ing.role.trim();
      if (!roleOrder.includes(role)) {
        roleOrder.push(role);
      }
    }
  });
  
  const roleFormatted = {};
  roleOrder.forEach(role => {
    const subs = groups[role];
    if (subs && subs.length > 0) {
      if (subs.length === 1) {
        roleFormatted[role] = `${role} (${subs[0]})`;
      } else {
        const plural = rolePlurals[role] || `${role}ים`;
        roleFormatted[role] = `${plural} (${subs.join(", ")})`;
      }
    }
  });
  
  const finalFormattedList = [];
  let roleIndexInFinal = {};
  
  ingredients.forEach(ing => {
    if (ing.role && ing.role !== "null" && ing.role !== "None") {
      const role = ing.role.trim();
      if (!roleIndexInFinal[role]) {
        if (roleFormatted[role]) {
          finalFormattedList.push(roleFormatted[role]);
        }
        roleIndexInFinal[role] = true;
      }
    } else {
      const displayName = ing.translated_text && ing.translated_text !== "null" ? ing.translated_text : ing.original_text;
      finalFormattedList.push(displayName);
    }
  });
  
  return finalFormattedList;
}

function updateHebrewIngredientsOutput() {
  if (state.currentIngredients.length === 0) {
    elements.hebrewIngredientsOutput.value = "";
    elements.hebrewCharCount.textContent = "0 characters";
    const allergenDisplay = document.getElementById("allergen-warnings-display");
    if (allergenDisplay) allergenDisplay.style.display = "none";
    return;
  }
  
  const groupedIngredients = groupHebrewAdditives(state.currentIngredients);
  
  let allergenText = "";
  const hasContains = state.currentContainsAllergens && state.currentContainsAllergens.length > 0;
  const hasMayContain = state.currentMayContainAllergens && state.currentMayContainAllergens.length > 0;
  
  if (hasContains || hasMayContain) {
    allergenText = "\nמידע על אלרגנים: ";
    if (hasContains) {
      allergenText += `מכיל: ${state.currentContainsAllergens.join(", ")}. `;
    }
    if (hasMayContain) {
      allergenText += `עלול להכיל: ${state.currentMayContainAllergens.join(", ")}.`;
    }
  }
  
  elements.hebrewIngredientsOutput.value = `רכיבים: ${groupedIngredients.join(", ")}.${allergenText}`;
  elements.hebrewCharCount.textContent = `${elements.hebrewIngredientsOutput.value.length} characters`;

  // Update visual allergen card in UI
  const allergenDisplay = document.getElementById("allergen-warnings-display");
  const allergenTextEl = document.getElementById("allergen-warnings-text");
  if (allergenDisplay && allergenTextEl) {
    if (hasContains || hasMayContain) {
      let warningText = "";
      if (hasContains) warningText += `מכיל: ${state.currentContainsAllergens.join(", ")}. `;
      if (hasMayContain) warningText += `עלול להכיל: ${state.currentMayContainAllergens.join(", ")}.`;
      allergenTextEl.textContent = warningText;
      allergenDisplay.style.display = "block";
    } else {
      allergenDisplay.style.display = "none";
    }
  }
}

// === EXPORTING AND SHARING ===
function copyHebrewLabel() {
  const outputText = elements.hebrewIngredientsOutput.value;
  if (!outputText) {
    showToast("No text to copy!");
    return;
  }
  
  navigator.clipboard.writeText(outputText)
    .then(() => showToast("Hebrew ingredient label copied to clipboard!"))
    .catch(() => showToast("Failed to copy ingredients."));
}

function escapeCsv(val) {
  if (val === null || val === undefined) {
    return "";
  }
  return String(val).replace(/"/g, '""');
}

function exportToCsv() {
  if (state.currentIngredients.length === 0) {
    showToast("No data to export!");
    return;
  }
  
  // UTF-8 BOM for Hebrew Excel compatibility
  let csvContent = "\uFEFF";
  csvContent += "Original Text,Translated Text,E-Number,Role,Details\n";
  
  state.currentIngredients.forEach(ing => {
    const orig = escapeCsv(ing.original_text);
    const trans = escapeCsv(ing.translated_text);
    const enumVal = escapeCsv(ing.e_number || "None");
    const roleVal = escapeCsv(ing.role || "None");
    const detailsVal = escapeCsv(ing.details || "");
    csvContent += `"${orig}","${trans}","${enumVal}","${roleVal}","${detailsVal}"\n`;
  });
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const timestamp = new Date().toISOString().substring(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `foodlabel_translation_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV file downloaded successfully!");
}

function formatTimestamp(d) {
  const pad = (num) => String(num).padStart(2, "0");
  const datePart = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${datePart} ${timePart}`;
}

function normalizeDateDisplay(timestampStr) {
  if (!timestampStr) return "";
  let clean = timestampStr.trim().replace(/,$/, "");
  
  if (clean.includes("/")) {
    const datePart = clean.split(/[,\s]+/)[0];
    const parts = datePart.split("/");
    if (parts.length === 3) {
      const month = parts[0].padStart(2, "0");
      const day = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${day}.${month}.${year}`;
    }
  }
  
  if (clean.includes(".")) {
    const datePart = clean.split(/[,\s]+/)[0];
    const parts = datePart.split(".");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${day}.${month}.${year}`;
    }
  }
  
  return clean;
}

// === HISTORICAL TRANSLATIONS MANAGER ===
function initHistory() {
  renderHistoryView();
  renderSidebarHistory();
}

function saveToHistory() {
  if (state.currentIngredients.length === 0) {
    showToast("No active translation to save!");
    return;
  }
  
  const title = state.currentIngredients.slice(0, 3).map(i => i.translated_text).join(", ") + "...";
  const rawInput = elements.rawIngredientsInput.value;
  
  const job = {
    id: "job_" + Date.now(),
    timestamp: formatTimestamp(new Date()),
    title: title,
    rawInput: rawInput,
    ingredients: JSON.parse(JSON.stringify(state.currentIngredients)), // deep copy
    containsAllergens: state.currentContainsAllergens || [],
    mayContainAllergens: state.currentMayContainAllergens || []
  };
  
  state.history.unshift(job);
  // Cap history at 50 records to save localstorage space
  if (state.history.length > 50) state.history.pop();
  
  safeSetLocalStorage("foodlabel_history", JSON.stringify(state.history));
  initHistory();
  showToast("Translation saved to history!");
}

function loadHistoryItem(jobId) {
  const item = state.history.find(j => j.id === jobId);
  if (!item) return;
  
  elements.rawIngredientsInput.value = item.rawInput;
  elements.rawCharCount.textContent = `${item.rawInput.length} characters`;
  
  state.currentIngredients = JSON.parse(JSON.stringify(item.ingredients));
  state.currentContainsAllergens = item.containsAllergens || [];
  state.currentMayContainAllergens = item.mayContainAllergens || [];
  
  renderBreakdownTable();
  updateHebrewIngredientsOutput();
  
  elements.resultsTableSection.style.display = "block";
  switchTab("dashboard", "Dashboard & Regulation");
  showToast("Translation restored from history!");
}

function deleteHistoryItem(jobId, event) {
  if (event) event.stopPropagation(); // Stop trigger history load on click
  state.history = state.history.filter(j => j.id !== jobId);
  safeSetLocalStorage("foodlabel_history", JSON.stringify(state.history));
  initHistory();
  showToast("Translation deleted from history.");
}

function renderHistoryView() {
  elements.historyItemsGrid.innerHTML = "";
  
  if (state.history.length === 0) {
    elements.historyItemsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">Your translation history is empty.</div>`;
    return;
  }
  
  state.history.forEach(job => {
    const card = document.createElement("div");
    card.className = "history-item-card";
    card.innerHTML = `
      <div class="history-item-header">
        <span>${normalizeDateDisplay(job.timestamp)}</span>
        <button class="row-actions-btn delete-hist-btn" title="Delete from history" style="color: var(--text-muted); hover: color: red;">
          &times;
        </button>
      </div>
      <div class="history-item-body">${job.title}</div>
      <div class="history-item-footer">Source: ${job.rawInput.substring(0, 45)}...</div>
    `;
    card.addEventListener("click", () => loadHistoryItem(job.id));
    
    // Add delete click handler
    card.querySelector(".delete-hist-btn").addEventListener("click", (e) => {
      deleteHistoryItem(job.id, e);
    });
    
    elements.historyItemsGrid.appendChild(card);
  });
}

function renderSidebarHistory() {
  elements.sidebarHistoryList.innerHTML = "";
  
  if (state.history.length === 0) {
    elements.sidebarHistoryList.innerHTML = `<div class="empty-state" style="padding: 10px; font-size: 0.8rem;">No saved translations</div>`;
    return;
  }
  
  // Show last 5 translations in sidebar
  state.history.slice(0, 5).forEach(job => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-card-header">
        <span>${normalizeDateDisplay(job.timestamp)}</span>
      </div>
      <div class="history-card-body">${job.title}</div>
    `;
    card.addEventListener("click", () => loadHistoryItem(job.id));
    elements.sidebarHistoryList.appendChild(card);
  });
}

// === TOAST POPUP NOTIFICATION ===
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  
  setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3000);
}

// === EVENT LISTENERS ===
function initEventListeners() {
  // Theme Switching
  elements.themeDarkBtn.addEventListener("click", () => setTheme("dark"));
  elements.themeLightBtn.addEventListener("click", () => setTheme("light"));
  
  if (elements.mobileThemeToggle) {
    elements.mobileThemeToggle.addEventListener("click", () => {
      if (state.theme === "dark") {
        setTheme("light");
      } else {
        setTheme("dark");
      }
    });
  }
  
  // Settings Dialog Toggle
  elements.menuSettingsBtn.addEventListener("click", openSettingsOverlay);
  elements.menuSettingsBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSettingsOverlay();
    }
  });
  elements.settingsCloseBtn.addEventListener("click", closeSettingsOverlay);
  elements.settingsCancelBtn.addEventListener("click", closeSettingsOverlay);
  elements.settingsSaveBtn.addEventListener("click", saveSettings);
  elements.translationModeSwitch.addEventListener("change", (e) => {
    toggleApiKeyField(e.target.checked);
  });
  
  // Close popups on backdrop click
  elements.settingsOverlay.addEventListener("click", (e) => {
    if (e.target === elements.settingsOverlay) closeSettingsOverlay();
  });
  elements.tooltipBackdrop.addEventListener("click", closeTooltip);
  elements.tooltipCloseBtn.addEventListener("click", closeTooltip);
  
  // Raw text area counter
  elements.rawIngredientsInput.addEventListener("input", (e) => {
    elements.rawCharCount.textContent = `${e.target.value.length} characters`;
  });
  
  // Clear Input button
  elements.clearInputBtn.addEventListener("click", () => {
    elements.rawIngredientsInput.value = "";
    elements.hebrewIngredientsOutput.value = "";
    elements.rawCharCount.textContent = "0 characters";
    elements.hebrewCharCount.textContent = "0 characters";
    elements.resultsTableSection.style.display = "none";
    state.currentIngredients = [];
    state.currentContainsAllergens = [];
    state.currentMayContainAllergens = [];
    showToast("Input and results cleared.");
  });
  
  // Translate button
  elements.translateBtn.addEventListener("click", handleTranslation);
  
  // Export and Share buttons
  elements.copyHebrewBtn.addEventListener("click", copyHebrewLabel);
  elements.exportCsvBtn.addEventListener("click", exportToCsv);
  elements.saveHistoryBtn.addEventListener("click", saveToHistory);
  
  // Database Live Search input
  elements.dbSearchInput.addEventListener("input", (e) => {
    renderDatabaseCards(e.target.value);
  });
}

// === UTILITY HELPERS ===
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Input Validator to check if text is likely food ingredients
function validateIngredientInput(text) {
  const clean = text.trim();
  if (clean.length < 3) {
    return { valid: false, message: "Input is too short to be an ingredient list." };
  }
  
  const letterCount = (clean.match(/[a-z]/gi) || []).length;
  
  // Must contain at least some letters (otherwise it is just numbers or symbols)
  if (letterCount === 0) {
    return { valid: false, message: "Input must contain at least some letters. Please enter a valid ingredient list." };
  }

  // Check if it contains any valid E-numbers pattern like E330 or INS 330 using word boundaries
  const hasENumberPattern = /\b(?:E|INS)?\s*-?\s*\d{3,4}\b/i.test(clean);

  // Must contain a reasonable ratio of letters (at least 25% of the input should be letters, unless it's E-numbers)
  const letterRatio = clean.length > 0 ? letterCount / clean.length : 0;
  if (letterRatio < 0.25 && !hasENumberPattern) {
    return { valid: false, message: "Input contains too many symbols or numbers. Please enter a valid ingredient list." };
  }

  // Common non-food conversational words (stop words)
  const conversationalStopWords = new Set([
    "i", "you", "he", "she", "they", "we", "my", "your", "his", "her", "their", 
    "want", "wants", "go", "goes", "went", "going", "sleep", "sleeps", "sleeping",
    "think", "thinks", "thought", "how", "what", "where", "when", "why", "who",
    "is", "am", "are", "was", "were", "be", "been", "do", "does", "did", "have", "has", "had",
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "because", "to", "for", "in", "on", "at", "by", "with",
    "play", "run", "write", "read", "study", "code", "work", "hello", "hi", "please", "thanks", "thank", "weather",
    "whoever", "whatever", "someone", "something", "eat", "eating"
  ]);

  const words = clean.toLowerCase().split(/[\s,.\-()]+/).map(w => w.replace(/[^a-z]/g, ""));
  
  // Count how many conversational stop words are in the input
  let stopWordCount = 0;
  let wordCount = 0;
  words.forEach(w => {
    if (w.length > 0) {
      wordCount++;
      if (conversationalStopWords.has(w)) {
        stopWordCount++;
      }
    }
  });

  const stopWordRatio = wordCount > 0 ? stopWordCount / wordCount : 0;
  
  // Check if it contains any known ingredients or E-numbers from our offline database
  let hasKnownIngredient = false;
  
  if (window.standardIngredientsMap) {
    words.forEach(w => {
      if (w.length > 0 && window.standardIngredientsMap[w]) {
        hasKnownIngredient = true;
      }
    });
  }

  if (window.chemicalToENumberMap) {
    const cleanLower = clean.toLowerCase();
    for (const chem of Object.keys(window.chemicalToENumberMap)) {
      if (cleanLower.includes(chem)) {
        hasKnownIngredient = true;
        break;
      }
    }
  }

  // If it is highly conversational and has no known ingredients or E-numbers, block it
  if (stopWordRatio > 0.4 && !hasKnownIngredient && !hasENumberPattern) {
    return { 
      valid: false, 
      message: "This input does not look like a list of food ingredients. Please enter a valid ingredient list." 
    };
  }

  return { valid: true };
}
