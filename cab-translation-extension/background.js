/* This is the controller for:
	•	keyboard shortcut (Ctrl/Cmd+Shift+Y)
	•	talking to the current tab
	•	opening/focusing your UI (popup won’t open programmatically like a panel)
	•	passing selected text around
*/
// CONSTs 
const STORAGE_KEYS = {
	options:"translatorOptions",
	latestRequest:"latestAnalyzeRequest"
};

const DEFAULT_OPTIONS = {
	apiBaseUrl: "http://localhost:3000",
	sourceLang: "auto",
	targetLang: "en",
	explanationStyle: "concise",
	youtubeFallback: true,
	debugMode: false
};

// Default init conditions on install
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.options);
    if (!data[STORAGE_KEYS.options]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.options]: DEFAULT_OPTIONS
      });
      console.log("[background] Default options initialized");
    }
  } catch (err) {
    console.error("[background] Failed to initialize defaults:", err);
  }
});


// ---- Utility: get active tab ----
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

// ---- Utility: determine if URL is injectable ----
function isSupportedTabUrl(url) {
  if (!url || typeof url !== "string") return false;

  // Content scripts won't run on these
  const blockedPrefixes = [
    "chrome://",
    "edge://",
    "about:",
    "chrome-extension://",
    "moz-extension://",
    "devtools://"
  ];

  return !blockedPrefixes.some(prefix => url.startsWith(prefix));
}

// ---- Ask content script for selection text ----
async function requestSelectedTextFromTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "GET_SELECTED_TEXT"
    });

    if (!response) {
      return { ok: false, error: "No response from content script." };
    }

    return {
      ok: true,
      text: response.text || "",
      source: response.source || "selection"
    };
  } catch (err) {
    // Common if content script is not available on page yet
    return {
      ok: false,
      error: err?.message || "Failed to contact content script."
    };
  }
}

// ---- Main action: capture selection and store/broadcast it ----
async function handleAnalyzeTrigger(trigger = "unknown") {
  try {
    const tab = await getActiveTab();

    if (!tab) {
      console.warn("[background] No active tab found");
      return;
    }

    if (!isSupportedTabUrl(tab.url)) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.latestRequest]: {
          text: "",
          trigger,
          status: "error",
          error: "This page is not supported by Chrome extensions.",
          tabUrl: tab.url || "",
          timestamp: Date.now()
        }
      });

      // Notify any open popup/sidepanel
      chrome.runtime.sendMessage({
        type: "ANALYZE_TEXT_READY",
        payload: {
          text: "",
          trigger,
          status: "error",
          error: "This page is not supported by Chrome extensions.",
          tabUrl: tab.url || "",
          timestamp: Date.now()
        }
      }).catch?.(() => {});

      return;
    }

    const result = await requestSelectedTextFromTab(tab.id);

    if (!result.ok) {
      const payload = {
        text: "",
        trigger,
        status: "error",
        error: result.error || "Could not get selected text.",
        tabId: tab.id,
        tabUrl: tab.url || "",
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [STORAGE_KEYS.latestRequest]: payload });

      chrome.runtime.sendMessage({
        type: "ANALYZE_TEXT_READY",
        payload
      }).catch?.(() => {});

      return;
    }

    const cleanedText = (result.text || "").trim();

    const payload = {
      text: cleanedText,
      trigger,
      status: cleanedText ? "ok" : "empty",
      source: result.source || "selection",
      tabId: tab.id,
      tabUrl: tab.url || "",
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.latestRequest]: payload });

    // Broadcast to popup/sidepanel if open
    chrome.runtime.sendMessage({
      type: "ANALYZE_TEXT_READY",
      payload
    }).catch?.(() => {});

    console.log("[background] Analyze trigger handled:", payload);
  } catch (err) {
    console.error("[background] handleAnalyzeTrigger error:", err);

    const payload = {
      text: "",
      trigger,
      status: "error",
      error: err?.message || "Unexpected background error.",
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.latestRequest]: payload });

    chrome.runtime.sendMessage({
      type: "ANALYZE_TEXT_READY",
      payload
    }).catch?.(() => {});
  }
}

// ---- Keyboard shortcut listener ----
chrome.commands.onCommand.addListener(async (command) => {
  console.log("[background] Command received:", command);

  // Match the command name from manifest.json
  if (
    command === "analyze-selection-or-sentence" ||
    command === "analyze-current-subtitle"
  ) {
    await handleAnalyzeTrigger("shortcut");
  }
});

// ---- Message listener (from popup.js / sidepanel.js) ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async wrapper because onMessage can't directly be async in MV3
  (async () => {
    if (!message || !message.type) return;

    switch (message.type) {
      case "PING":
        sendResponse({ ok: true, from: "background" });
        break;

      case "GET_LATEST_ANALYZE_REQUEST": {
        const data = await chrome.storage.local.get(STORAGE_KEYS.latestRequest);
        sendResponse({
          ok: true,
          payload: data[STORAGE_KEYS.latestRequest] || null
        });
        break;
      }

      case "TRIGGER_ANALYZE_SELECTION": {
        await handleAnalyzeTrigger(message.trigger || "popup");
        sendResponse({ ok: true });
        break;
      }

      default:
        // Unknown message type
        sendResponse({ ok: false, error: "Unknown message type." });
        break;
    }
  })().catch((err) => {
    console.error("[background] onMessage error:", err);
    sendResponse({ ok: false, error: err?.message || "Background message error." });
  });

  // Keep message channel open for async sendResponse
  return true;
});

const DEEPL_KEY = "433a6554-ee2e-447e-abc5-a67011a18cb3:fx";        // WE WILL NEED TO REMOVE THIS probably

// Context menu button 
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cabTranslate",
    title: "DeepL translate",
    contexts: ["selection"]
  });
});

// Translate text using an async call to DeepL API and return the translated text
async function translateText(text, targetLang = "EN") {
  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${DEEPL_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang
    })
  });

  const data = await response.json();

  if (!data.translations || !data.translations.length) {
    throw new Error("No translation returned");
  }

  return data.translations[0].text;
}

// Insert the translated line with a line break before and after
function insertTranslation(tabId, translatedText) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (text) => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);

      const translatedSection = document.createDocumentFragment();
      translatedSection.appendChild(document.createElement("br"));
      translatedSection.appendChild(document.createTextNode(text));
      translatedSection.appendChild(document.createElement("br"));

      range.collapse(); 
      range.insertNode(translatedSection);

      selection.removeAllRanges();
    },
    args: [translatedText]
  });
}

// Listener for the context menu button
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "cabTranslate") return;
  if (!info.selectionText) return;

  try {
    const translated = await translateText(info.selectionText, "EN");
    insertTranslation(tab.id, translated);
  } catch (error) {
    console.error("Translation failed:", error);
  }
});