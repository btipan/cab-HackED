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

  const response = await sendRuntimeMessage({ type: "TRANSLATE_TEXT", text });
  const translatedText = String(response?.translatedText || "").trim() || fallbackTranslate(text);

  statusText.style.display = 'Enter text here.';

  output.value = translatedText;
});

// Definition button
definitionBtn.addEventListener("click", async () => {
    const word = textInput.value.trim();
    if (!word) {
        definition.innerHTML = "<em>Enter a word.</em>";
        return;
    }

    // TODO: use chrome.storage to get saved source/target languages
    const sourceLang = "auto";
    const targetLang = "en";

    const result = await sendRuntimeMessage({
        type: "GET_DEFINITION",
        word,
        from: sourceLang,
        to: targetLang
    });

    if (!result || !result.translations) {
        definition.innerHTML = "<strong>No definition found.</strong>";
        return;
    }

    // Format nicely with HTML
    let html = '';
    result.translations.forEach((t, idx) => {
        html += '<div style="margin-bottom:12px;">';
        
        // Word + POS
        html += `<span style="font-size:16px;">${t.translation || "N/A"}</span> `;
        html += `<span style="font-size:14px; color:#555;">(${t.posTag || "N/A"})</span><br>`;
        
        // synonyms
        if (t.backTranslations && t.backTranslations.length) {
            html += `&nbsp;&nbsp;<strong>Synonyms:</strong> ${t.backTranslations.join(", ")}<br>`;
        }
        
        // Examples
        if (t.sourceExample && t.targetExample) {
            html += `&nbsp;&nbsp;<strong>Example:</strong><br>`;
            html += `&nbsp;&nbsp;&nbsp;&nbsp;<em>${result.sourceLang}:</em> ${t.sourceExample}<br>`;
            html += `&nbsp;&nbsp;&nbsp;&nbsp;<em>${result.targetLang}:</em> ${t.targetExample}<br>`;
        }
        
        html += `</div>`;
    });

    definition.innerHTML = html;
});