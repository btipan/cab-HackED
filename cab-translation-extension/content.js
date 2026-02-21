/* Highlight-selection translation content script. */

let selectionPopup = null;
let selectedRange = null;
let selectionUpdateTimer = null;
let selectionTranslationEnabled = true;
const FALLBACK_PREFIX = "[Translated] ";

function createSelectionPopup() {
  if (selectionPopup) {
    return;
  }

  selectionPopup = document.createElement("div");
  selectionPopup.id = "cab-translation-selection-popup";
  selectionPopup.style.position = "fixed";
  selectionPopup.style.zIndex = "2147483647";
  selectionPopup.style.display = "none";
  selectionPopup.style.background = "#ffffff";
  selectionPopup.style.color = "#ffffff";
  selectionPopup.style.padding = "8px";
  selectionPopup.style.borderRadius = "8px";
  selectionPopup.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
  selectionPopup.style.fontFamily = "Arial, sans-serif";
  selectionPopup.style.fontSize = "12px";

  const translateBtn = document.createElement("button");
  translateBtn.type = "button";
  translateBtn.textContent = "Translate";
  translateBtn.style.border = "0";
  translateBtn.style.borderRadius = "6px";
  translateBtn.style.padding = "6px 10px";
  translateBtn.style.cursor = "pointer";
  translateBtn.style.background = "#AFBC88";
  translateBtn.style.color = "#ffffff";

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

    try {
      const translatedText = await translateTextWithFallback(text);

      if (translatedText) {
        const replacement = document.createTextNode(translatedText);
        selectedRange.deleteContents();
        selectedRange.insertNode(replacement);
      }

      window.getSelection()?.removeAllRanges();
    } finally {
      translateBtn.disabled = false;
      translateBtn.textContent = "Translate";
      hideSelectionPopup();
    }
  });
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

  let left = rect.left + rect.width / 2 - popupWidth / 2;
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
