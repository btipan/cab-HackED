document.addEventListener("DOMContentLoaded", () => {
  const cardBtn = document.getElementById("card-btn");
  const historyBtn = document.getElementById("history-btn");

  const flashcardsView = document.getElementById("flashcards-view");
  const historyView = document.getElementById("history-view");

  const cardsContainer = document.getElementById("cards");
  const historyContainer = document.getElementById("history-list");

  function showView(viewName) {
    if (flashcardsView) flashcardsView.hidden = viewName !== "flashcards";
    if (historyView) historyView.hidden = viewName !== "history";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function loadFlashcards() {
    if (!cardsContainer) return;

    try {
      const { flashcards = [] } = await chrome.storage.local.get({ flashcards: [] });
      console.log(flashcards);

      cardsContainer.innerHTML = "";

      if (!flashcards.length) {
        cardsContainer.innerHTML = "<p>No flashcards yet.</p>";
        return;
      }

      flashcards.forEach((card) => {
        const div = document.createElement("div");
        div.className = "flashcard";

        // Supports either { original, translation } or fallback fields if naming changes later
        const original = card.original ?? card.sourceText ?? "";
        const translation = card.translation ?? card.translatedText ?? "";

        div.innerHTML = `
        <div class="flashcard-inner">
            <div class="flashcard-face flashcard-front">
            <strong>${escapeHtml(original)}</strong>
            </div>
            <div class="flashcard-face flashcard-back">
            ${escapeHtml(translation)}
            </div>
        </div>
        `;
        div.addEventListener('click', () => {
            div.classList.toggle('flipped');
        });

        cardsContainer.appendChild(div);
      });
    } catch (err) {
      console.error("[dashboard] loadFlashcards error:", err);
      cardsContainer.innerHTML = "<p>Failed to load flashcards.</p>";
    }
  }

  async function loadHistory() {
    if (!historyContainer) return;

    try {
      const { translationHistory = [] } = await chrome.storage.local.get({
        translationHistory: []
      });

      historyContainer.innerHTML = "";

      if (!translationHistory.length) {
        historyContainer.innerHTML = "<p>No translation history yet.</p>";
        return;
      }

      const recent = [...translationHistory]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 30);

      recent.forEach((item) => {
        const row = document.createElement("div");
        row.className = "history-item";

        const dateText = item.timestamp
          ? new Date(item.timestamp).toLocaleString()
          : "Unknown time";

        const original = item.original ?? item.text ?? "";
        const translated = item.translatedText ?? item.translation ?? "";
        const sourceLang = item.sourceLang ?? "auto";
        const targetLang = item.targetLang ?? "EN";
        const trigger = item.trigger ?? "";

        row.innerHTML = `
          <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:8px; background:#fff;">
            <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:6px;">
              <strong style="font-size:13px;">${escapeHtml(original)}</strong>
              <span style="font-size:12px; color:#6b7280;">${escapeHtml(dateText)}</span>
            </div>

            <div style="font-size:13px; margin-bottom:4px;">
              <span style="color:#6b7280;">→</span> ${escapeHtml(translated)}
            </div>

            <div style="font-size:12px; color:#6b7280;">
              ${escapeHtml(sourceLang)} → ${escapeHtml(targetLang)}
              ${trigger ? ` • ${escapeHtml(trigger)}` : ""}
            </div>
          </div>
        `;

        historyContainer.appendChild(row);
      });
    } catch (err) {
      console.error("[dashboard] loadHistory error:", err);
      historyContainer.innerHTML = "<p>Failed to load history.</p>";
    }
  }

  cardBtn?.addEventListener("click", async () => {
    showView("flashcards");
    await loadFlashcards();
  });

  historyBtn?.addEventListener("click", async () => {
    showView("history");
    await loadHistory();
  });

  // Default page state
  showView("history");
  loadHistory().catch(console.error);
});

document.getElementById("settings-btn").onclick = () => {
  window.location.href = "../options.html"};