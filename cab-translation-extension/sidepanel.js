const textInput = document.getElementById("textInput");
const output = document.getElementById("output");
const definition = document.getElementById("definition");
const statusText = document.getElementById("status");
const translateTextBtn = document.getElementById("translateTextBtn");
const definitionBtn = document.getElementById("definitionBtn");

function fallbackTranslate(text) {
  const clean = String(text || "").trim();
  return clean ? `[Translated] ${clean}` : "";
}

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

translateTextBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();
  if (!text) {
    statusText.textContent = "Enter text here.";
    return;
  }

  statusText.textContent = "Translating...";

  const response = await sendRuntimeMessage({ action: "translateText", text });
  const translatedText = String(response?.translatedText || "").trim() || fallbackTranslate(text);

  statusText.style.display = 'Enter text here.';

  output.value = translatedText;
});

// Definition button
definitionBtn.addEventListener("click", async () => {
    const word = textInput.value.trim();
    // TODO: fix hardcoded languages (use chrome.storage)
    const sourceLang = 'auto'
    const targetLang = 'en'

    const result = await sendRuntimeMessage({
        type: "GET_DEFINITION",
        word,
        from: sourceLang,
        to: targetLang
    });

    if (!result || !result.translations) {
        definition.value = "No definition found.";
    } else {
        definition.value = JSON.stringify(result, null, 2);
    }
});