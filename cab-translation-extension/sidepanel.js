// Navigation buttons
document.querySelectorAll('.nav-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    const viewId = btn.getAttribute('data-view');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
  });
});

// Grab elements per view
const textInput = document.getElementById("textInput");
const output = document.getElementById("output");
const translateTextBtn = document.getElementById("translateTextBtn");

const textInputDef = document.getElementById("textInputDef");
const definition = document.getElementById("definition");
const definitionBtn = document.getElementById("definitionBtn");

const textInputExp = document.getElementById("textInputExp");
const explain = document.getElementById("explain");
const explainBtn = document.getElementById("explainBtn");
const sourceLangIn = document.getElementById("source");
const targetLangIn = document.getElementById("target");

const statusText = document.getElementById("status");

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

// Translate
translateTextBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();
  if (!text) {
    statusText.textContent = "Enter text here.";
    return;
  }

  statusText.textContent = "Translating...";
  const response = await sendRuntimeMessage({ type: "TRANSLATE_TEXT", text });
  output.value = String(response?.translatedText || fallbackTranslate(text));
  statusText.textContent = "Done.";
});

// Definition
definitionBtn.addEventListener("click", async () => {
  const word = textInputDef.value.trim();
  if (!word) {
    definition.innerHTML = "<em>Enter a word.</em>";
    return;
  }

  const result = await sendRuntimeMessage({
    type: "GET_DEFINITION",
    word,
    from: "auto",
    to: "en"
  });

  if (!result || !result.translations) {
    definition.innerHTML = "<strong>No definition found.</strong>";
    return;
  }

  let html = '';
  result.translations.forEach((t) => {
    html += '<div style="margin-bottom:12px;">';
    html += `<span style="font-size:16px;">${t.translation || "N/A"}</span> `;
    html += `<span style="font-size:14px; color:#555;">(${t.posTag || "N/A"})</span><br>`;

     html += `
      <button 
        class="flash-btn" 
        data-word="${word}"
        data-translation="${t.translation}"
        style="margin-left:8px; padding:4px 8px; font-size:8px; cursor:pointer;">
        Create Flashcard
      </button><br>
    `;

    if (t.backTranslations?.length) html += `&nbsp;&nbsp;<strong>Synonyms:</strong> ${t.backTranslations.join(", ")}<br>`;
    if (t.sourceExample && t.targetExample) {
      html += `&nbsp;&nbsp;<strong>Example:</strong><br>`;
      html += `&nbsp;&nbsp;&nbsp;&nbsp;<em>${result.sourceLang}:</em> ${t.sourceExample}<br>`;
      html += `&nbsp;&nbsp;&nbsp;&nbsp;<em>${result.targetLang}:</em> ${t.targetExample}<br>`;
    }
    html += '</div>';
  });

  definition.innerHTML = html;
});

definition.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("flash-btn")) return;

  const word = e.target.dataset.word;
  const translation = e.target.dataset.translation;

  console.log("Using:", word, translation);

  await sendRuntimeMessage({
    type: "CREATE_FLASHCARD",
    word,
    translation
  });
});

// Explain
explainBtn.addEventListener('click', async () => {
  const text = textInputExp.value.trim();
  const targetLang = targetLangIn.value;
  const sourceLang = sourceLangIn.value;

  const result = await sendRuntimeMessage({
    type: "GET_EXPLANATION",
    text,
    sourceLang,
    targetLang
  });

  explain.value = result || "Error getting explanation.";
});