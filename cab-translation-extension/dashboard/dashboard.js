const cardBtn = document.getElementById('card-btn');

async function loadFlashcards() {
  const { flashcards } = await chrome.storage.local.get({ flashcards: [] });

  const container = document.getElementById("cards");
  container.innerHTML = "";

  flashcards.forEach(card => {
    const div = document.createElement("div");
    div.className = "flashcard";

    div.innerHTML = `
      <div class="front">${card.original}</div>
      <div class="back">${card.translation}</div>
    `;

    container.appendChild(div);
  });
}

cardBtn.addEventListener('click', () => {loadFlashcards()});