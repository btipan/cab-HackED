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

const DEF_KEY = 'EhZY1LIjvO0gFNHY7QskYeedly4Ni9SNeFbytspOjNqoPAoxHOQQJQQJ99CBACBsN54XJ3w3AAAbACOGPo7x';
const DEF_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';
const DEF_REGION = 'canadacentral';

async function addFlashcard(original, translation) {
  const newCard = {
    id: original,
    translation
  }

  const data = await chrome.storage.local.get({flashcards: []});

  const updatedFlashcards = [...data.flashcards, newCard];
  await chrome.storage.local.set({flashcards: updatedFlashcards});
}

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

      case "GET_DEFINITION": {
        const { word, from, to } = message;
        try {
          const result = await getTranslationAndExample(word, from, to);
          sendResponse(result);
        } catch (err) {
          sendResponse({ error: err.message });
        }
        break;
      }

      case "TRANSLATE_TEXT": {
        translateText(message.text)
          .then(result => {
            sendResponse({ translatedText: result });
          })
          .catch(error => {
            console.error(error);
            sendResponse({ translatedText: null });
          });
          break;
      }

      case "CREATE_FLASHCARD": {
        addFlashcard(message.original, message.translation)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error(error);
            sendResponse({ success: false });
          });
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

const DEEPL_KEY = '433a6554-ee2e-447e-abc5-a67011a18cb3:fx';        // WE WILL NEED TO REMOVE THIS probably

// Context menu button 
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'cabTranslate',
    title: 'DeepL translate',
    contexts: ["selection"]
  });
});

// Translate text using an async call to DeepL API and return the translated text
async function translateText(text, targetLang = 'EN') {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang
    })
  });

  const data = await response.json();

  if (!data.translations || !data.translations.length) {
    throw new Error('No translation returned');
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

      // Make sure element is not interactive
      let inter = range.startContainer.parentElement?.closest('a', 'button', 'label', 'summary', 'textarea', 'input', 'select');

      const wrapper = document.createElement('span');
      wrapper.className = 'cab-translation-wrapper';
      wrapper.appendChild(document.createElement('br'));

      // Build the text
      const span = document.createElement('span');
      span.textContent = text;
      span.className = 'cab-translation-text';

      // Build the undo button with svg for back arrow
      const undoBtn = document.createElement('button');
      undoBtn.className = 'cab-undo-btn';
      undoBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path fill="currentColor"
              d="M12 5v4l-5-5 5-5v4c5 0 9 4 9 9a9 9 0 0 1-9 9v-2a7 7 0 0 0 0-14z"/>
          </svg>
        `;
      undoBtn.title = 'undo translation';

      // Event listener for removal of the entire wrapper
      undoBtn.addEventListener('click', () => {
        wrapper.remove();
      });
      wrapper.appendChild(span);
      wrapper.appendChild(undoBtn);
      wrapper.appendChild(document.createElement('br'));

      // If it is interactive, put it immediately after
      if (inter) {
        inter.parentNode.insertBefore(wrapper, inter.nextSibling);
      } else {
        range.collapse();
        range.insertNode(wrapper);
      }

      selection.removeAllRanges();
    },
    args: [translatedText]
  });
}

// Listener for the context menu button
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'cabTranslate') return;
  if (!info.selectionText) return;

  try {
    const translated = await translateText(info.selectionText, 'EN');       // AHHHHHHHHHHHHHHHHHHH
    insertTranslation(tab.id, translated);
  } catch (error) {
    console.error('Translation failed:', error);
  }
});

async function getTranslationAndExample(word, from='auto', to) {
    try {
        // Helper: generate a random trace ID (needed so we dont have to import uuid)
        function generateTraceId() {
            return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        }

         // detect language if 'from' is auto
        if (from === "auto") {
            from = await detectLanguage(word);
        }

        // Dictionary lookup
        const lookupUrl = `${DEF_ENDPOINT}/dictionary/lookup?api-version=3.0&from=${from}&to=${to}`;
        const lookupResp = await fetch(lookupUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': DEF_KEY,
                'Ocp-Apim-Subscription-Region': DEF_REGION,
                'Content-Type': 'application/json',
                'X-ClientTraceId': generateTraceId()
            },
            body: JSON.stringify([{ text: word }])
        });

        if (!lookupResp.ok) {
            throw new Error(`Dictionary lookup failed: ${lookupResp.status} ${lookupResp.statusText}`);
        }

        const entries = await lookupResp.json();
        const results = [];

        for (const entry of entries) {
            for (const t of entry.translations) {
                const targetWord = t.normalizedTarget;
                const posTag = t.posTag || null;

                // Back translation
                const backTranslations = (t.backTranslations || [])
                    .map(bt => bt.normalizedText)
                    .filter(btWord => btWord !== targetWord);

                // Examples
                let sourceExample = null;
                let targetExample = null;

                if (targetWord) {
                    const exampleUrl = `${DEF_ENDPOINT}/dictionary/examples?api-version=3.0&from=${to}&to=${from}`;
                    const exampleResp = await fetch(exampleUrl, {
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': DEF_KEY,
                            'Ocp-Apim-Subscription-Region': DEF_REGION,
                            'Content-Type': 'application/json',
                            'X-ClientTraceId': generateTraceId()
                        },
                        body: JSON.stringify([{ text: targetWord, translation: word }])
                    });

                    if (!exampleResp.ok) {
                        console.warn(`Example lookup failed for ${targetWord}: ${exampleResp.status}`);
                    } else {
                        const exampleData = await exampleResp.json();
                        const examples = exampleData?.[0]?.examples || [];
                        if (examples.length > 0) {
                            const ex = examples[0];
                            targetExample = `${ex.sourcePrefix}${ex.sourceTerm}${ex.sourceSuffix}`;
                            sourceExample = `${ex.targetPrefix}${ex.targetTerm}${ex.targetSuffix}`;
                        }
                    }
                }

                results.push({
                    translation: targetWord,
                    posTag,
                    backTranslations,
                    sourceExample,
                    targetExample
                });
            }
        }

        return {
          sourceWord: word, 
          sourceLang: from, 
          targetLang: to, 
          translations: results.length > 0 ? results : null 
        };

    } catch (err) {
        return { error: err.message || 'Unknown error' };
    }
}

async function detectLanguage(text) {
    try {
        // Helper: generate a random trace ID
        function generateTraceId() {
            return Array.from({ length: 32 }, () =>
                Math.floor(Math.random() * 16).toString(16)
            ).join('');
        }

        // Detect language via Microsoft Translator API
        const detectUrl = `${DEF_ENDPOINT}/detect?api-version=3.0`;
        const resp = await fetch(detectUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': DEF_KEY,
                'Ocp-Apim-Subscription-Region': DEF_REGION,
                'Content-Type': 'application/json',
                'X-ClientTraceId': generateTraceId()
            },
            body: JSON.stringify([{ text }])
        });

        if (!resp.ok) {
            throw new Error(`Language detection failed: ${resp.status} ${resp.statusText}`);
        }

        const data = await resp.json();
        return data?.[0]?.language || 'en'; // fallback to English if detection fails

    } catch (err) {
        console.error("detectLanguage error:", err);
        return 'en'; // fallback to English on error
    }
}
