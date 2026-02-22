/* Highlight-selection translation content script. */
let selectionPopup = null;
let selectedRange = null;
let selectionUpdateTimer = null;
let selectionTranslationEnabled = true;
const FALLBACK_PREFIX = "[Translated] ";

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

function createSelectionPopup() {
  if (selectionPopup) {
    return;
  }

  selectionPopup = document.createElement("div");
  selectionPopup.id = "cab-translation-selection-popup";
  selectionPopup.className = "cab-translation-selection-popup";

  const translateBtn = document.createElement("button");
  translateBtn.type = "button";
  translateBtn.textContent = "Translate";
  translateBtn.className = "cab-translation-button";

  selectionPopup.appendChild(translateBtn);
  document.documentElement.appendChild(selectionPopup);

  selectionPopup.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });

  translateBtn.addEventListener("click", async () => {
    if (!selectedRange) {
      hideSelectionPopup();
      return;
    }

    const text = selectedRange.toString().trim();
    if (!text) {
      hideSelectionPopup();
      return;
    }

    translateBtn.disabled = true;
    translateBtn.textContent = "Translating...";

    const response = await sendRuntimeMessage({ type: "TRANSLATE_POPUP", text});
    const translatedText = String(response?.translatedText || "").trim() || FALLBACK_PREFIX;

    showPopup(translatedText);

    // Placeholder - just show the selected text in the popup for now
    //showPopup(text);
    
    translateBtn.disabled = false;
    translateBtn.textContent = "Translate";
  });
}

function showPopup(translatedText) {
  if (!selectedRange) return;

  const popup = document.getElementById("popupbase");
  if (!popup) {
    return;
  }

  popup.innerHTML = `<div>${translatedText || "No translation available"}</div>`;
  
  const rect = selectedRange.getBoundingClientRect();
  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 10;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.display = "block";

  function onClickOutside(e) {
    if (popup.contains(e.target)) return;
    popup.style.display = "none";
    document.removeEventListener('mousedown', onClickOutside);
  }
  document.addEventListener('mousedown', onClickOutside);

  const sidePanelIcon = document.createElement("button");
  sidePanelIcon.innerHTML = '<img src="' + chrome.runtime.getURL("./cab.png") + '" alt="Panel" />';
  sidePanelIcon.onclick = (e) => {
    console.log("Button clicked!");
    e.stopPropagation();
    alert("Side panel opened!");
  }
  popup.appendChild(sidePanelIcon);
  
  
}

function hideSelectionPopup() {
  if (selectionPopup) {
    selectionPopup.style.display = "none";
  }
}

if (!document.getElementById("popupbase")) {
  const popupBase = document.createElement("div");
  popupBase.id = "popupbase";
  popupBase.className = "popupbase";
  document.documentElement.appendChild(popupBase);
}

function showSelectionPopupForRange(range) {
  createSelectionPopup();
  if (!selectionPopup) {
    return;
  }

  selectedRange = range.cloneRange();

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    hideSelectionPopup();
    return;
  }

  const popupWidth = 150;
  const popupHeight = 40;
  const margin = 8;

  let left = rect.left + rect.width / 2 + popupWidth / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

  let top = rect.top - popupHeight - margin;
  if (top < margin) {
    top = rect.bottom + margin;
  }

  selectionPopup.style.left = `${left}px`;
  selectionPopup.style.top = `${top}px`;
  selectionPopup.style.display = "block";
}

function handleSelectionPopup() {
  if (!selectionTranslationEnabled) {
    hideSelectionPopup();
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    hideSelectionPopup();
    return;
  }

  const range = selection.getRangeAt(0);
  if (!range || !range.toString().trim()) {
    hideSelectionPopup();
    return;
  }

  showSelectionPopupForRange(range);
}

function scheduleSelectionPopupUpdate() {
  if (selectionUpdateTimer) {
    clearTimeout(selectionUpdateTimer);
  }

  selectionUpdateTimer = setTimeout(() => {
    handleSelectionPopup();
    selectionUpdateTimer = null;
  }, 0);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "getSelectionTranslationState") {
    sendResponse({ enabled: selectionTranslationEnabled });
    return;
  }
  else if (message?.type === "GET_SELECTED_TEXT") {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  sendResponse({ text, source: "selection" });
  return;
  }

  if (message?.action === "setSelectionTranslationEnabled") {
    selectionTranslationEnabled = Boolean(message.enabled);
    if (!selectionTranslationEnabled) {
      hideSelectionPopup();
    }
    sendResponse({ enabled: selectionTranslationEnabled });
    return;
  }

  if (message?.action === "translateCurrentSelectionNow") {
    (async () => {
      const ok = await translateSelectionImmediately();
      sendResponse({ ok });
    })();
    return true;
  }
});

document.addEventListener("selectionchange", scheduleSelectionPopupUpdate);
document.addEventListener("mouseup", scheduleSelectionPopupUpdate);
document.addEventListener("keyup", scheduleSelectionPopupUpdate);

document.addEventListener("mousedown", (event) => {
  if (!selectionPopup || selectionPopup.style.display !== "block") {
    return;
  }

  if (!selectionPopup.contains(event.target)) {
    hideSelectionPopup();
  }
});

window.addEventListener("scroll", hideSelectionPopup, true);
window.addEventListener("resize", hideSelectionPopup);
