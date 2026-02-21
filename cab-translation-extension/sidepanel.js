const textInput = document.getElementById("textInput");
const output = document.getElementById("output");
const statusText = document.getElementById("status");
const translateTextBtn = document.getElementById("translateTextBtn");

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

  output.value = translatedText;
});