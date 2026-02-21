const translateBtn = document.getElementById("translateBtn");
const openPanelBtn = document.getElementById("openPanelBtn");
const quickThirdBtn = document.getElementById("openThirdBtn");
const openFourthBtn = document.getElementById("openFourthBtn");
const dashBtn = document.getElementById("dash-btn");
const statusText = document.getElementById("status");

function setTranslationMode(isEnabled) {
  translateBtn.textContent = isEnabled
    ? "Disable Translation"
    : "Enable Translation";
  translateBtn.classList.toggle("on", isEnabled);
  statusText.textContent = isEnabled
    ? "Translation is ON."
    : "Translation is OFF.";
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0] ?? null);
    });
  });
}

function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || {});
    });
  });
}

async function refreshState() {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    return;
  }

  try {
    const response = await sendToTab(activeTab.id, { action: "getSelectionTranslationState" });
    setTranslationMode(Boolean(response?.enabled));
  } catch (_error) {
  }
}

translateBtn.addEventListener("click", async () => {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    return;
  }

  try {
    const current = await sendToTab(activeTab.id, { action: "getSelectionTranslationState" });
    const nextEnabled = !Boolean(current?.enabled);

    const response = await sendToTab(activeTab.id, {
      action: "setSelectionTranslationEnabled",
      enabled: nextEnabled,
    });

    setTranslationMode(Boolean(response?.enabled));
  } catch (_error) {
  }
});

openPanelBtn.addEventListener("click", async () => {
  const activeTab = await getActiveTab();
  if (!activeTab?.windowId || !activeTab?.id) {
    return;
  }

  try {
    await chrome.sidePanel.setOptions({
      tabId: activeTab.id,
      path: "sidepanel.html",
      enabled: true,
    });
    await chrome.sidePanel.open({ windowId: activeTab.windowId });
  } catch (_error) {
  }
});

// quickThirdBtn.addEventListener("click", () => {return});
// openFourthBtn.addEventListener("click", () => {return});
dashBtn.addEventListener('click', () => {
  chrome.windows.create({
    url: chrome.runtime.getURL('dashboard/dashboard.html'),
    type:'popup',
    width: 1100,
    height: 800
  })
});

refreshState();
