// options.js as-is ; wire sidepanel.js to read translatorOptions.apiBaseUrl, sourceLang, targetLang, and explanationStyle before calling backend stuff!

const STORAGE_KEY = "translatorOptions";

const DEFAULT_OPTIONS = {
  // apiBaseUrl: "http://localhost:3000",
  sourceLang: "JA",
  targetLang: "EN-US",
  // explanationStyle: "concise",
  // youtubeFallback: true,
  // debugMode: false
};

// Form elements
// const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const sourceLangSelect = document.getElementById("sourceLang");
const targetLangSelect = document.getElementById("targetLang");
// const explanationStyleSelect = document.getElementById("explanationStyle");
// const youtubeFallbackCheckbox = document.getElementById("youtubeFallback");
// const debugModeCheckbox = document.getElementById("debugMode");

const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

function showStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove("error", "success");
  statusEl.classList.add(isError ? "error" : "success");
}

function clearStatusToReady() {
  if (!statusEl) return;
  statusEl.textContent = "Ready.";
  statusEl.classList.remove("error", "success");
}

function applyOptionsToForm(options) {
  const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };

  // apiBaseUrlInput.value = merged.apiBaseUrl; 
  sourceLangSelect.value = merged.sourceLang;
  targetLangSelect.value = merged.targetLang;
  // explanationStyleSelect.value = merged.explanationStyle;
  // youtubeFallbackCheckbox.checked = Boolean(merged.youtubeFallback);
  // debugModeCheckbox.checked = Boolean(merged.debugMode);
}

function readOptionsFromForm() {
  return {
    // apiBaseUrl: apiBaseUrlInput.value.trim(),
    sourceLang: sourceLangSelect.value,
    targetLang: targetLangSelect.value,
    // explanationStyle: explanationStyleSelect.value,
    // youtubeFallback: youtubeFallbackCheckbox.checked,
    // debugMode: debugModeCheckbox.checked
  };
}

function validateOptions(options) {
  // API URL non-empty
  // if (!options.apiBaseUrl) {
  //   return { ok: false, message: "API Base URL is required." };
  // }

  // // API URL starts with http:// or https://
  // if (!/^https?:\/\/.+/i.test(options.apiBaseUrl)) {
  //   return { ok: false, message: "API Base URL must start with http:// or https://." };
  // }

  // source/target cannot be identical if source is explicit (not auto)
  if (options.sourceLang !== "AUTO" && options.sourceLang === options.targetLang) {
    return {
      ok: false,
      message: "Source and target languages cannot be the same when source is explicit."
    };
  }

  return { ok: true };
}

async function loadOptions() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const savedOptions = result?.[STORAGE_KEY];

    if (!savedOptions) {
      applyOptionsToForm(DEFAULT_OPTIONS);
      clearStatusToReady();
      return;
    }

    applyOptionsToForm(savedOptions);
    clearStatusToReady();
  } catch (error) {
    console.error("[options] loadOptions error:", error);
    applyOptionsToForm(DEFAULT_OPTIONS);
    showStatus("Failed to load saved settings. Using defaults.", true);
  }
}

async function saveOptions() {
  try {
    const options = readOptionsFromForm();
    const validation = validateOptions(options);

    if (!validation.ok) {
      showStatus(validation.message, true);
      return;
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: options });
    showStatus("Saved.");
  } catch (error) {
    console.error("[options] saveOptions error:", error);
    showStatus("Failed to save settings.", true);
  }
}

function resetOptions() {
  applyOptionsToForm(DEFAULT_OPTIONS);
  showStatus("Defaults restored. Click Save to apply.");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadOptions();

  saveBtn?.addEventListener("click", saveOptions);
  resetBtn?.addEventListener("click", resetOptions);

  //  clear success/error styling when end user edits fields
  [
    sourceLangSelect,
    targetLangSelect,
    // explanationStyleSelect,
    // youtubeFallbackCheckbox,
    // debugModeCheckbox
  ].forEach((el) => {
    el?.addEventListener("input", clearStatusToReady);
    el?.addEventListener("change", clearStatusToReady);
  });
});

// const sourceDropdown = document.getElementById('source-dropdown');
// const targetDropdown = document.getElementById('target-dropdown');

// // Load saved language from Chrome storage
// chrome.storage.sync.get(['sourceLanguage'], (data) => {
//   if (data.sourceLanguage) {
//     sourceDropdown.value = data.sourceLanguage;
//   }
// });

// // Save selected language
// sourceDropdown.addEventListener('change', () => {
//   chrome.storage.sync.set({ sourceLanguage: sourceDropdown.value });
// });

// // Load saved language from Chrome storage
// chrome.storage.sync.get(['targetLanguage'], (data) => {
//   if (data.targetLanguage) {
//     targetDropdown.value = data.targetLanguage;
//   }
// });

// // Save selected language
// targetDropdown.addEventListener('change', () => {
//   chrome.storage.sync.set({ targetLanguage: targetDropdown.value });
// });


document.getElementById("backbutton").onclick = () => {
  window.location.href = "./dashboard/dashboard.html";};