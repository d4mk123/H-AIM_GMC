/* ══════════════════════════════════════════════════════════════════
   9. LAUNCH FEED & INITIALIZE APP
   ══════════════════════════════════════════════════════════════════ */
async function launchAppFeed() {
  const initials = `${state.profile.name.charAt(0)}${state.profile.surname.charAt(0)}`.toUpperCase();
  userAvatarInitial.textContent = initials || "N";
  userNameDisplay.textContent = `${state.profile.name} ${state.profile.surname}`;
  userRoleDisplay.textContent = state.profile.occupation;

  welcomePage.classList.remove("active");
  appLayout.classList.add("active");

  await loadSeedItems();
  loadSquadsAndTrending();
  await rankFeed();
  startAutoSync();
}

async function loadSeedItems() {
  try {
    const res = await fetch("seed_items.json");
    const rawItems = await res.json();
    state.items = rawItems.map((item) => ({
      ...item,
      description: item.description || item.summary || "",
      url: item.url || item.link || "#",
    }));
    state.items.forEach((item, idx) => {
      if (state.upvotes[item.id] === undefined) {
        state.upvotes[item.id] = 14 + ((idx * 5) % 31);
      }
    });
  } catch (err) {
    console.error("Failed to load seed items:", err);
  }
}

/* ══════════════════════════════════════════════════════════════════
   14. BOOTSTRAP
   ══════════════════════════════════════════════════════════════════ */
initCustomSelects();
initRegisterInterestGrid();

// Restore profile data into memory if saved, but ALWAYS show the welcome/home page first on refresh
const savedProfile = JSON.parse(localStorage.getItem("nabdh_profile") || "null");
if (savedProfile) {
  Object.assign(state.profile, savedProfile);
}

welcomePage.classList.add("active");
appLayout.classList.remove("active");
window.scrollTo(0, 0);