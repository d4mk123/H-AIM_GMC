/* ══════════════════════════════════════════════════════════════════
   4. CUSTOM SELECTS & TAGS
   ══════════════════════════════════════════════════════════════════ */
function initCustomSelects() {
  document.querySelectorAll(".custom-select").forEach((select) => {
    const trigger = select.querySelector(".custom-select__trigger");
    const textEl = select.querySelector(".custom-select__text");
    const options = select.querySelectorAll(".custom-select__option");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".custom-select.open").forEach((s) => {
        if (s !== select) s.classList.remove("open");
      });
      select.classList.toggle("open");
    });

    options.forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        select.dataset.value = val;
        textEl.textContent = opt.textContent;
        textEl.classList.remove("placeholder-text");

        options.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        select.classList.remove("open");
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((s) => s.classList.remove("open"));
  });
}

function initRegisterInterestGrid() {
  const container = regInterestGrid;
  if (!container) return;

  container.innerHTML = INTEREST_OPTIONS.map((opt) =>
    `<button type="button" class="tag-chip" data-interest="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
  ).join("");

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".tag-chip");
    if (chip) {
      chip.classList.toggle("selected");
      updateRecommendations();
    }
  });

  if (regRecommendationsGrid) {
    regRecommendationsGrid.addEventListener("click", (e) => {
      const chip = e.target.closest(".tag-chip");
      if (chip) {
        chip.classList.toggle("selected");
      }
    });
  }
}

function updateRecommendations() {
  if (!regRecommendationsGroup || !regRecommendationsGrid) return;

  const selectedPrimary = [];
  document.querySelectorAll("#reg-interest-grid .tag-chip.selected").forEach((btn) => {
    selectedPrimary.push(btn.dataset.interest || btn.textContent.trim());
  });

  const activeSelectedRecs = new Set();
  document.querySelectorAll("#reg-recommendations-grid .tag-chip.selected").forEach((btn) => {
    let t = btn.dataset.interest || btn.textContent.trim();
    t = t.replace(/^\+\s*/, "");
    activeSelectedRecs.add(t);
  });

  if (selectedPrimary.length === 0 && activeSelectedRecs.size === 0) {
    regRecommendationsGroup.style.display = "none";
    regRecommendationsGrid.innerHTML = "";
    return;
  }

  const recsSet = new Set();
  selectedPrimary.forEach((interest) => {
    const list = INTEREST_RECOMMENDATIONS[interest];
    if (list) {
      list.forEach((item) => recsSet.add(item));
    }
  });

  activeSelectedRecs.forEach((item) => recsSet.add(item));

  if (recsSet.size === 0) {
    regRecommendationsGroup.style.display = "none";
    regRecommendationsGrid.innerHTML = "";
    return;
  }

  regRecommendationsGroup.style.display = "block";
  regRecommendationsGrid.innerHTML = Array.from(recsSet).map((rec) => {
    const isSelected = activeSelectedRecs.has(rec) ? " selected" : "";
    return `<button type="button" class="tag-chip recommendation-chip${isSelected}" data-interest="${escapeHtml(rec)}">+ ${escapeHtml(rec)}</button>`;
  }).join("");
}

function getSelectedInterests() {
  const interests = [];
  document.querySelectorAll("#reg-interest-grid .tag-chip.selected, #reg-recommendations-grid .tag-chip.selected").forEach((btn) => {
    let val = btn.dataset.interest || btn.textContent.trim();
    val = val.replace(/^\+\s*/, "");
    if (val && !interests.includes(val)) {
      interests.push(val);
    }
  });
  return { interests, skillLevels: {} };
}