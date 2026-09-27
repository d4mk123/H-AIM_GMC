/**
 * app.js — Nabdh Application Engine
 * ──────────────────────────────────
 * Welcome Landing page, Login & Multi-step Registration,
 * Gemini AI personalized ranking, bookmarks, upvoting,
 * card detail popup, custom dropdowns, interest categories,
 * and background feed auto-sync.
 *
 * All AI calls go directly to the Gemini REST API — no backend needed.
 */

/* ══════════════════════════════════════════════════════════════════
   1. APPLICATION STATE
   ══════════════════════════════════════════════════════════════════ */
const GEMINI_API_KEY = (window.__NABDH_GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = "gemini-2.0-flash";

const state = {
  user: JSON.parse(localStorage.getItem("nabdh_user") || "null"),
  profile: {
    name: "",
    surname: "",
    email: "",
    phone: "",
    country: "Tunisia",
    address: "",
    occupation: "CS student",
    interests: [],
    skillLevels: {},
    refreshInterval: 25,
  },
  items: [],
  rankedFeed: [],
  bookmarks: new Set(JSON.parse(localStorage.getItem("nabdh_bookmarks") || "[]")),
  upvotes: JSON.parse(localStorage.getItem("nabdh_upvotes") || "{}"),
  feedback: [],
  activeView: "feed",
  activeType: "all",
  activeSquad: "all",
  searchQuery: "",
  isRanking: false,
  countdown: 25,
  countdownTimer: null,
  refreshTimer: null,
};

/* ══════════════════════════════════════════════════════════════════
   2. INTEREST OPTIONS (flat tag chips)
   ══════════════════════════════════════════════════════════════════ */
const INTEREST_OPTIONS = [
  "AI & Machine Learning",
  "Cloud & DevOps",
  "Web Development",
  "Mobile Apps",
  "Data Science & Big Data",
  "Cybersecurity",
  "Blockchain & Web3",
  "IoT & Robotics",
  "Startups & Business",
  "UI/UX Design",
  "Fintech",
  "Open Source",
  "Backend Engineering",
  "Frontend Engineering",
  "APIs & Microservices",
  "Python & AI Tools"
];

const INTEREST_RECOMMENDATIONS = {
  "UI/UX Design": [
    "Figma", "Adobe Illustrator", "Photoshop", "Wireframing", "Design Systems", "Prototyping"
  ],
  "AI & Machine Learning": [
    "PyTorch", "TensorFlow", "LLMs & Prompt Eng", "Computer Vision", "NLP & Transformers", "Hugging Face"
  ],
  "Web Development": [
    "React", "Next.js", "Vue.js", "Node.js", "TypeScript", "Tailwind CSS", "HTML5 & CSS3"
  ],
  "Cloud & DevOps": [
    "AWS", "Docker", "Kubernetes", "CI/CD Pipelines", "Terraform", "Linux & Bash", "GCP / Azure"
  ],
  "Mobile Apps": [
    "Flutter", "React Native", "Swift & iOS", "Kotlin & Android", "Mobile UI", "Expo"
  ],
  "Data Science & Big Data": [
    "Pandas & NumPy", "SQL & Database Design", "Data Visualization", "Tableau / Power BI", "Apache Spark", "ETL Pipelines"
  ],
  "Cybersecurity": [
    "Ethical Hacking", "Network Defense", "Penetration Testing", "Security Auditing", "Cryptography", "SOC Analysis"
  ],
  "Blockchain & Web3": [
    "Solidity", "Smart Contracts", "Ethereum & EVM", "DeFi Protocols", "Web3.js / Ethers.js"
  ],
  "IoT & Robotics": [
    "Arduino", "Raspberry Pi", "ROS (Robot Operating System)", "Sensor Networks", "Embedded C/C++"
  ],
  "Startups & Business": [
    "Product Management", "Growth Hacking", "Pitching & Fundraising", "Lean Startup", "SaaS Business Models"
  ],
  "Fintech": [
    "Payment Gateways (Stripe/Flouci)", "Algorithmic Trading", "Open Banking APIs", "Financial Compliance"
  ],
  "Open Source": [
    "Git & GitHub Workflows", "Contributing to OSS", "Documentation Writing", "Community Management"
  ],
  "Backend Engineering": [
    "PostgreSQL", "Redis & Caching", "GraphQL", "Microservices", "REST APIs", "Go / Golang", "Django / FastAPI"
  ],
  "Frontend Engineering": [
    "Modern JavaScript", "Component Architecture", "CSS Animations", "Web Performance", "State Management"
  ],
  "APIs & Microservices": [
    "API Gateway", "gRPC", "Message Queues (RabbitMQ/Kafka)", "Postman & OpenAPI", "Auth & JWT"
  ],
  "Python & AI Tools": [
    "LangChain", "LlamaIndex", "Jupyter Notebooks", "FastAPI", "Automation & Scripting"
  ]
};

/* ══════════════════════════════════════════════════════════════════
   3. STATIC DATA (Squads, Trending)
   ══════════════════════════════════════════════════════════════════ */
const TUNISIAN_SQUADS = [
  { id: "all", name: "All Ecosystem", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, members: "12.4k", tag: "all" },
  { id: "squad-ai", name: "Tunisia AI Builders", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg>`, members: "4.8k", tag: "AI" },
  { id: "squad-cloud", name: "Cloud & DevOps TN", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`, members: "3.2k", tag: "cloud" },
  { id: "squad-jobs", name: "Junior Devs & Interns", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`, members: "6.1k", tag: "internship" },
  { id: "squad-startups", name: "Tunis Founders & VCs", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, members: "2.9k", tag: "startups" },
  { id: "squad-cyber", name: "CyberSec Carthage", icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, members: "1.7k", tag: "cybersecurity" }
];

const TRENDING_TOPICS = [
  { tag: "#AI_Strategy_2030", count: "1.4k reads", delta: "+48%" },
  { tag: "#InstaDeep_ESA", count: "980 reads", delta: "+35%" },
  { tag: "#ESPRIT_AWS", count: "820 reads", delta: "+29%" },
  { tag: "#DevFest_Hammamet", count: "640 reads", delta: "+22%" },
  { tag: "#StartupAct2", count: "510 reads", delta: "+15%" }
];

/* ══════════════════════════════════════════════════════════════════
   4. DOM REFERENCES
   ══════════════════════════════════════════════════════════════════ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const welcomePage       = $("#welcome-page");
const appLayout         = $("#app-layout");
const authModalOverlay  = $("#auth-modal-overlay");
const loginView         = $("#login-view");
const registerView      = $("#register-view");

const welcomeLoginBtn   = $("#welcome-login-btn");
const welcomeSignupBtn  = $("#welcome-signup-btn");
const heroGoogleBtn     = $("#hero-google-btn");
const heroGithubBtn     = $("#hero-github-btn");
const heroEmailBtn      = $("#hero-email-btn");
const heroLoginLinkBtn  = $("#hero-login-link-btn");
const footerCtaSignupBtn= $("#footer-cta-signup-btn");
const authCloseBtn      = $("#auth-close-btn");
const switchToRegisterBtn = $("#switch-to-register-btn");
const switchToLoginBtn  = $("#switch-to-login-btn");

const regStep1          = $("#reg-step-1");
const regStep2          = $("#reg-step-2");
const stepSeg1          = $("#step-seg-1");
const stepSeg2          = $("#step-seg-2");
const registerStepTitle = $("#register-step-title");
const btnNextStep       = $("#btn-next-step");
const btnBackStep       = $("#btn-back-step");
const regInterestGrid   = $("#reg-interest-grid");
const regRecommendationsGroup = $("#reg-recommendations-group");
const regRecommendationsGrid  = $("#reg-recommendations-grid");
const registerForm      = $("#register-form");
const btnFinishRegister = $("#btn-finish-register");
const loginForm         = $("#login-form");

const demoStudentLogin  = $("#demo-student-login");
const demoCloudLogin    = $("#demo-cloud-login");

const navItems          = $$(".nav-item");
const feedCountBadge    = $("#feed-count-badge");
const bookmarkCountBadge= $("#bookmark-count-badge");
const squadsNav         = $("#squads-nav");
const sidebarTags       = $("#sidebar-tags");
const userNameDisplay   = $("#user-name-display");
const userRoleDisplay   = $("#user-role-display");
const userAvatarInitial = $("#user-avatar-initial");
const quickLogoutBtn    = $("#quick-logout-btn");
const exitToWelcomeBtn  = $("#exit-to-welcome-btn");

const searchInput       = $("#search-input");
const typePills         = $("#type-pills");
const currentViewTitle  = $("#current-view-title");
const cardsContainer    = $("#cards-container");
const emptyFeed         = $("#empty-feed");
const aiStatusMessage   = $("#ai-status-message");
const aiModelTag        = $("#ai-model-tag");

const syncProgressBar   = $("#sync-progress-bar");
const syncCountdownText = $("#sync-countdown-text");
const manualRefreshBtn  = $("#manual-refresh-btn");

const trendingContainer = $("#trending-container");
const upcomingEventsContainer = $("#upcoming-events-container");

// Card detail popup
const cardDetailOverlay = $("#card-detail-overlay");
const cardDetailClose   = $("#card-detail-close");

/* ══════════════════════════════════════════════════════════════════
   5. CUSTOM SELECT DROPDOWNS
   ══════════════════════════════════════════════════════════════════ */
function initCustomSelects() {
  document.querySelectorAll(".custom-select").forEach((select) => {
    const trigger = select.querySelector(".custom-select__trigger");
    const textEl = select.querySelector(".custom-select__text");
    const options = select.querySelectorAll(".custom-select__option");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close all other open selects
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

  // Close dropdowns on outside click
  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((s) => s.classList.remove("open"));
  });
}

/* ══════════════════════════════════════════════════════════════════
   6. TECH INTEREST TAGS & SMART RECOMMENDATIONS
   ══════════════════════════════════════════════════════════════════ */
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

  // Find all selected primary interests
  const selectedPrimary = [];
  document.querySelectorAll("#reg-interest-grid .tag-chip.selected").forEach((btn) => {
    selectedPrimary.push(btn.dataset.interest || btn.textContent.trim());
  });

  // Preserve recommendations the user already selected
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

  // Aggregate recommendations from all chosen primary interests
  const recsSet = new Set();
  selectedPrimary.forEach((interest) => {
    const list = INTEREST_RECOMMENDATIONS[interest];
    if (list) {
      list.forEach((item) => recsSet.add(item));
    }
  });

  // Always keep user-selected recommendation chips in the list
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

/* ══════════════════════════════════════════════════════════════════
   7. SCREEN TRANSITIONS & AUTH MODAL
   ══════════════════════════════════════════════════════════════════ */

function openAuthModal(view = "login") {
  authModalOverlay.classList.add("active");
  if (view === "login") {
    loginView.classList.add("active");
    registerView.classList.remove("active");
  } else {
    registerView.classList.add("active");
    loginView.classList.remove("active");
    showRegisterStep(1);
  }
}

function closeAuthModal() {
  authModalOverlay.classList.remove("active");
}

function showRegisterStep(step) {
  if (step === 1) {
    regStep1.classList.add("active");
    regStep2.classList.remove("active");
    stepSeg1.classList.add("active");
    stepSeg2.classList.remove("active");
    registerStepTitle.textContent = "Step 1 of 2 — Personal Details";
  } else {
    regStep1.classList.remove("active");
    regStep2.classList.add("active");
    stepSeg1.classList.add("active");
    stepSeg2.classList.add("active");
    registerStepTitle.textContent = "Step 2 of 2 — Role & AI Feed Settings";
  }
}

welcomeLoginBtn.addEventListener("click", () => openAuthModal("login"));
welcomeSignupBtn.addEventListener("click", () => openAuthModal("register"));
heroGoogleBtn.addEventListener("click", () => quickDemoLogin("student"));
heroGithubBtn.addEventListener("click", () => quickDemoLogin("cloud"));
heroEmailBtn.addEventListener("click", () => openAuthModal("register"));
heroLoginLinkBtn.addEventListener("click", () => openAuthModal("login"));
footerCtaSignupBtn.addEventListener("click", () => openAuthModal("register"));

authCloseBtn.addEventListener("click", closeAuthModal);
authModalOverlay.addEventListener("click", (e) => {
  if (e.target === authModalOverlay) closeAuthModal();
});

switchToRegisterBtn.addEventListener("click", () => {
  loginView.classList.remove("active");
  registerView.classList.add("active");
  showRegisterStep(1);
});

switchToLoginBtn.addEventListener("click", () => {
  registerView.classList.remove("active");
  loginView.classList.add("active");
});

/* ══════════════════════════════════════════════════════════════════
   8. REGISTRATION & LOGIN LOGIC
   ══════════════════════════════════════════════════════════════════ */

btnNextStep.addEventListener("click", () => {
  const name = $("#reg-name").value.trim();
  const surname = $("#reg-surname").value.trim();
  const email = $("#reg-email").value.trim();
  const phone = $("#reg-phone").value.trim();
  const address = $("#reg-address").value.trim();

  if (!name || !surname || !email || !phone || !address) {
    alert("Please fill in all fields.");
    return;
  }

  showRegisterStep(2);
});

btnBackStep.addEventListener("click", () => showRegisterStep(1));

// Complete Registration
async function handleRegistrationSubmit() {
  const { interests, skillLevels } = getSelectedInterests();

  if (interests.length === 0) {
    alert("Please select at least one tech interest.");
    return;
  }

  const roleSelect = $("#reg-role-select");
  let role = roleSelect && roleSelect.dataset.value ? roleSelect.dataset.value : "CS student";

  const refreshSelect = $("#reg-refresh-select");
  const countrySelect = $("#reg-country-select");

  const nameVal = $("#reg-name") ? $("#reg-name").value.trim() : "";
  const surnameVal = $("#reg-surname") ? $("#reg-surname").value.trim() : "";
  const emailVal = $("#reg-email") ? $("#reg-email").value.trim() : "";
  const phoneVal = $("#reg-phone") ? $("#reg-phone").value.trim() : "";
  const addressVal = $("#reg-address") ? $("#reg-address").value.trim() : "";

  state.profile.name = nameVal || "Tech Pioneer";
  state.profile.surname = surnameVal || "TN";
  state.profile.email = emailVal || "user@nabdh.tn";
  state.profile.phone = phoneVal || "+216 98 000 000";
  state.profile.country = (countrySelect && countrySelect.dataset.value) ? countrySelect.dataset.value : "Tunisia";
  state.profile.address = addressVal || "Tunis";
  state.profile.occupation = role;
  state.profile.interests = interests;
  state.profile.skillLevels = skillLevels;
  state.profile.refreshInterval = parseInt(refreshSelect && refreshSelect.dataset.value ? refreshSelect.dataset.value : "25", 10);

  state.user = {
    name: `${state.profile.name} ${state.profile.surname}`.trim(),
    role: state.profile.occupation,
    email: state.profile.email,
  };
  localStorage.setItem("nabdh_user", JSON.stringify(state.user));
  localStorage.setItem("nabdh_profile", JSON.stringify(state.profile));

  closeAuthModal();
  await launchAppFeed();
}

if (btnFinishRegister) {
  btnFinishRegister.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleRegistrationSubmit();
  });
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await handleRegistrationSubmit();
});

// Login Form
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nameInput = $("#login-name").value.trim();
  const surnameInput = $("#login-surname").value.trim();
  const emailInput = $("#login-email").value.trim();

  if (!nameInput || !surnameInput) {
    alert("Please enter your first name and surname.");
    return;
  }

  state.profile.name = nameInput;
  state.profile.surname = surnameInput;
  state.profile.email = emailInput;

  const savedProfile = JSON.parse(localStorage.getItem("nabdh_profile") || "null");
  if (savedProfile) {
    state.profile.occupation = savedProfile.occupation || state.profile.occupation;
    state.profile.interests = savedProfile.interests || state.profile.interests;
    state.profile.skillLevels = savedProfile.skillLevels || {};
    state.profile.refreshInterval = savedProfile.refreshInterval || state.profile.refreshInterval;
  }

  // If no saved interests, use defaults
  if (!state.profile.interests || state.profile.interests.length === 0) {
    state.profile.interests = ["AI & ML", "Cloud & DevOps", "Data Science"];
  }

  state.user = {
    name: `${nameInput} ${surnameInput}`,
    role: state.profile.occupation,
    email: emailInput,
  };
  localStorage.setItem("nabdh_user", JSON.stringify(state.user));

  closeAuthModal();
  await launchAppFeed();
});

// Fast Demo Logins
demoStudentLogin.addEventListener("click", () => quickDemoLogin("student"));
demoCloudLogin.addEventListener("click", () => quickDemoLogin("cloud"));

async function quickDemoLogin(type) {
  if (type === "student") {
    state.profile = {
      name: "Ahmed", surname: "Ben Salem",
      email: "ahmed.insat@gmail.com", phone: "+216 98 123 456",
      country: "Tunisia", address: "INSAT, Centre Urbain Nord, Tunis",
      occupation: "CS student",
      interests: ["AI & ML", "Cloud & DevOps", "Data Science", "LLMs & agents", "AWS"],
      skillLevels: { "LLMs & agents": "Just starting", "AWS / GCP / Azure": "Comfortable" },
      refreshInterval: 25,
    };
  } else {
    state.profile = {
      name: "Sarra", surname: "Mansour",
      email: "sarra.cloud@vermeg.com", phone: "+216 55 987 654",
      country: "Tunisia", address: "Les Berges du Lac 2, Tunis",
      occupation: "Junior developer",
      interests: ["Cloud & DevOps", "Backend", "Kubernetes & containers", "CI/CD pipelines"],
      skillLevels: { "Kubernetes & containers": "Comfortable", "CI/CD pipelines": "Could teach it" },
      refreshInterval: 25,
    };
  }

  state.user = {
    name: `${state.profile.name} ${state.profile.surname}`,
    role: state.profile.occupation,
    email: state.profile.email,
  };
  localStorage.setItem("nabdh_user", JSON.stringify(state.user));
  localStorage.setItem("nabdh_profile", JSON.stringify(state.profile));

  closeAuthModal();
  await launchAppFeed();
}

function returnToWelcome() {
  stopAutoSync();
  appLayout.classList.remove("active");
  welcomePage.classList.add("active");
  window.scrollTo(0, 0);
}

// Bind returnToWelcome to top navigation exit button, brand logo, and logout
document.querySelectorAll("#exit-to-welcome-btn, #brand-logo-home, .brand-logo-small").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    returnToWelcome();
  });
});

if (quickLogoutBtn) {
  quickLogoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("nabdh_user");
    state.user = null;
    returnToWelcome();
  });
}

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

function loadSquadsAndTrending() {
  renderSquads(TUNISIAN_SQUADS);
  renderTrending(TRENDING_TOPICS);
  renderUpcomingEvents();
}

function renderSquads(squads) {
  squadsNav.innerHTML = squads.map((s) => `
    <button class="squad-btn ${state.activeSquad === s.tag ? "active" : ""}" data-squad="${s.tag}">
      <span class="squad-icon">${s.icon}</span>
      <span class="squad-name">${escapeHtml(s.name)}</span>
      <span class="squad-members">${s.members}</span>
    </button>
  `).join("");

  squadsNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".squad-btn");
    if (!btn) return;
    $$(".squad-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeSquad = btn.dataset.squad;
    currentViewTitle.textContent = btn.querySelector(".squad-name").textContent;
    renderFeed();
  });
}

function renderTrending(trending) {
  trendingContainer.innerHTML = trending.map((t) => `
    <div class="trending-item" data-query="${t.tag.replace('#', '')}">
      <div>
        <div class="trend-tag">${escapeHtml(t.tag)}</div>
        <div class="trend-reads">${t.count}</div>
      </div>
      <div class="trend-delta">${t.delta}</div>
    </div>
  `).join("");

  trendingContainer.addEventListener("click", (e) => {
    const item = e.target.closest(".trending-item");
    if (!item) return;
    searchInput.value = item.dataset.query;
    state.searchQuery = item.dataset.query.toLowerCase();
    renderFeed();
  });
}

function renderUpcomingEvents() {
  const events = state.items.filter((it) => it.type === "event").slice(0, 3);
  upcomingEventsContainer.innerHTML = events.map((ev) => `
    <div class="event-mini-card" data-id="${ev.id}">
      <div class="event-mini-title">${escapeHtml(ev.title)}</div>
      <div class="event-mini-meta">
        <span>${escapeHtml(ev.location || "Tunis")}</span>
        <span>${formatDate(ev.date)}</span>
      </div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════════════════════════
   10. GEMINI AI RANKING (Direct API Call)
   ══════════════════════════════════════════════════════════════════ */

function buildSystemPrompt() {
  return `You are a content-ranking AI for Nabdh, a Tunisian tech feed app.
You will receive a user profile and a list of content items (tech news, job postings, internships, and events — all Tunisia-based).

Your job:
1. Rank ALL items from most to least relevant for this specific user.
2. For each item, write a SHORT one-line reason (max 15 words).
3. Assign a relevance score from 0 to 100.

Output ONLY valid JSON array:
[{ "id": "<item id>", "score": <0-100>, "reason": "<one-line reason>" }, ...]

Rules:
- Rank ALL items. Match interests semantically. Keep reasons conversational.
- Consider skill levels: "Just starting" users want learning resources; "Could teach it" users want advanced/expert content.`;
}

function buildUserPrompt(profile, items, feedback) {
  const profileStr = JSON.stringify({
    occupation: profile.occupation,
    interests: profile.interests,
    skillLevels: profile.skillLevels || {},
    feedback_history: feedback || [],
  });
  const cleanItems = items.map(({ score, reason, ...rest }) => rest);
  return `USER PROFILE:\n${profileStr}\n\nCONTENT ITEMS:\n${JSON.stringify(cleanItems)}`;
}

async function callGeminiAPI(systemPrompt, userPrompt) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key is not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096, topP: 0.9, responseMimeType: "application/json" },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

async function rankFeed() {
  if (state.isRanking) return;
  state.isRanking = true;
  aiStatusMessage.textContent = "AI reasoning over your profile...";

  try {
    const raw = await callGeminiAPI(buildSystemPrompt(), buildUserPrompt(state.profile, state.items, state.feedback));
    const ranked = JSON.parse(raw.trim());
    if (!Array.isArray(ranked)) throw new Error("Not a JSON array");

    const itemMap = new Map(state.items.map((it) => [it.id, it]));
    const result = ranked.filter((r) => itemMap.has(r.id)).map((r) => ({ ...itemMap.get(r.id), score: r.score, reason: r.reason }));
    for (const item of state.items) {
      if (!result.find((r) => r.id === item.id)) {
        result.push({ ...item, score: 5, reason: "Not directly related to your current focus" });
      }
    }
    state.rankedFeed = result;
    aiStatusMessage.textContent = `Ranked by Gemini AI for ${state.profile.name}`;
    aiModelTag.textContent = GEMINI_MODEL;
  } catch (err) {
    console.error("AI rank failed:", err);
    state.rankedFeed = clientFallbackRank();
    aiStatusMessage.textContent = "Offline ranking active";
    aiModelTag.textContent = "client-fallback";
  }

  state.isRanking = false;
  renderFeed();
}

function clientFallbackRank() {
  const interestSet = new Set(state.profile.interests.map((t) => t.toLowerCase()));
  return [...state.items].map((it) => {
    const tags = (it.tags || []).map((t) => t.toLowerCase());
    let score = 25;
    const matched = [];
    for (const t of tags) { if (interestSet.has(t)) { score += 25; matched.push(t); } }
    return { ...it, score: Math.min(score, 99), reason: matched.length > 0 ? `Matches your focus on ${matched.slice(0, 2).join(" & ")}` : "Relevant Tunisian tech opportunity" };
  }).sort((a, b) => b.score - a.score);
}

/* ══════════════════════════════════════════════════════════════════
   11. CARD DETAIL POPUP
   ══════════════════════════════════════════════════════════════════ */

function openCardDetail(item) {
  const detailType = $("#detail-type");
  const detailScore = $("#detail-score");
  const detailTitle = $("#detail-title");
  const detailSource = $("#detail-source");
  const detailLocation = $("#detail-location");
  const detailDate = $("#detail-date");
  const detailDesc = $("#detail-desc");
  const detailReason = $("#detail-reason");
  const detailReasonBlock = $("#detail-reason-block");
  const detailTags = $("#detail-tags");
  const detailLink = $("#detail-link");
  const detailBookmarkBtn = $("#detail-bookmark-btn");

  detailType.textContent = item.type.toUpperCase();
  detailType.setAttribute("data-type", item.type);
  detailScore.textContent = item.score != null ? `${item.score}% fit` : "";
  detailTitle.textContent = item.title;
  detailSource.textContent = item.source || "Tunisia Tech";
  detailLocation.textContent = item.location || "Tunisia";
  detailDate.textContent = formatDate(item.date);
  detailDesc.textContent = item.description;

  if (item.reason) {
    detailReasonBlock.style.display = "block";
    detailReason.textContent = item.reason;
  } else {
    detailReasonBlock.style.display = "none";
  }

  detailTags.innerHTML = (item.tags || []).map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join("");

  detailLink.href = item.url || "#";
  if (!item.url || item.url === "#") {
    detailLink.style.pointerEvents = "none";
    detailLink.style.opacity = "0.5";
  } else {
    detailLink.style.pointerEvents = "auto";
    detailLink.style.opacity = "1";
  }

  const isBookmarked = state.bookmarks.has(item.id);
  detailBookmarkBtn.querySelector("span").textContent = isBookmarked ? "Bookmarked" : "Bookmark";
  detailBookmarkBtn.classList.toggle("active", isBookmarked);
  detailBookmarkBtn.onclick = () => {
    if (state.bookmarks.has(item.id)) {
      state.bookmarks.delete(item.id);
    } else {
      state.bookmarks.add(item.id);
    }
    localStorage.setItem("nabdh_bookmarks", JSON.stringify([...state.bookmarks]));
    const nowBookmarked = state.bookmarks.has(item.id);
    detailBookmarkBtn.querySelector("span").textContent = nowBookmarked ? "Bookmarked" : "Bookmark";
    detailBookmarkBtn.classList.toggle("active", nowBookmarked);
    renderFeed();
  };

  cardDetailOverlay.classList.add("active");
}

function closeCardDetail() {
  cardDetailOverlay.classList.remove("active");
}

cardDetailClose.addEventListener("click", closeCardDetail);
cardDetailOverlay.addEventListener("click", (e) => {
  if (e.target === cardDetailOverlay) closeCardDetail();
});

/* ══════════════════════════════════════════════════════════════════
   12. FEED RENDERING & FILTERING
   ══════════════════════════════════════════════════════════════════ */

function getTypeIcon(type) {
  const icons = {
    news: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
    job: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    internship: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    event: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  };
  return icons[type] || `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
}

function renderFeed() {
  let displayList = [...state.rankedFeed];

  if (state.activeView === "popular") {
    displayList.sort((a, b) => (state.upvotes[b.id] || 0) - (state.upvotes[a.id] || 0));
  } else if (state.activeView === "recent") {
    displayList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  } else if (state.activeView === "bookmarks") {
    displayList = displayList.filter((it) => state.bookmarks.has(it.id));
  }

  if (state.activeType !== "all") displayList = displayList.filter((it) => it.type === state.activeType);

  if (state.activeSquad !== "all") {
    const sq = state.activeSquad.toLowerCase();
    displayList = displayList.filter((it) => it.type.toLowerCase() === sq || (it.tags || []).some((t) => t.toLowerCase().includes(sq)));
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    displayList = displayList.filter((it) => it.title.toLowerCase().includes(q) || it.description.toLowerCase().includes(q) || (it.tags || []).some((t) => t.toLowerCase().includes(q)));
  }

  feedCountBadge.textContent = displayList.length;
  bookmarkCountBadge.textContent = state.bookmarks.size;

  if (displayList.length === 0) { cardsContainer.innerHTML = ""; emptyFeed.classList.remove("hidden"); return; }
  emptyFeed.classList.add("hidden");

  cardsContainer.innerHTML = displayList.map((item) => {
    const isBookmarked = state.bookmarks.has(item.id);
    const upvoteCount = state.upvotes[item.id] || 0;
    const isUpvoted = state.upvotes[`${item.id}_voted`] === true;
    const isDismissed = state.feedback.some((f) => f.itemId === item.id && !f.relevant);

    return `
      <article class="nabdh-card ${isDismissed ? "dismissed" : ""}" data-id="${item.id}">
        <div class="card-header">
          <div class="card-source-info">
            <span class="source-avatar">${getTypeIcon(item.type)}</span>
            <span class="source-name">${escapeHtml(item.source || "Tunisia Tech")}</span>
            <span class="verified-icon">&#10003;</span>
            <span class="meta-bullet">&middot;</span>
            ${item.location ? `<span class="card-location">${escapeHtml(item.location)}</span><span class="meta-bullet">&middot;</span>` : ""}
            <span class="card-time">${formatDate(item.date)}</span>
          </div>
          <span class="type-badge type-badge--${item.type}">${item.type}</span>
        </div>

        <h2 class="card-title">
          <a href="javascript:void(0)" class="card-title-link" data-card-click="${item.id}">${escapeHtml(item.title)}</a>
        </h2>

        <p class="card-summary">${escapeHtml(item.description)}</p>

        ${item.reason ? `
          <div class="ai-reason-pill">
            <span class="ai-reason-pill__icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg></span>
            <span class="ai-reason-pill__text">${escapeHtml(item.reason)}</span>
            ${item.score != null ? `<span class="ai-score-tag">${item.score}%</span>` : ""}
          </div>
        ` : ""}

        ${item.tags && item.tags.length > 0 ? `<div class="card-tags-row">${item.tags.map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join("")}</div>` : ""}

        <div class="card-toolbar">
          <div class="toolbar-left">
            <button class="tool-btn tool-btn--upvote ${isUpvoted ? "active" : ""}" data-action="upvote" data-id="${item.id}" title="Upvote">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <span>${upvoteCount}</span>
            </button>
            <button class="tool-btn tool-btn--comment" data-action="discuss" data-id="${item.id}" title="Discussion">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>${(item.title.length % 9) + 2}</span>
            </button>
          </div>
          <div class="toolbar-right">
            <button class="tool-btn tool-btn--bookmark ${isBookmarked ? "active" : ""}" data-action="bookmark" data-id="${item.id}" title="Bookmark">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${isBookmarked ? 'var(--accent-primary)' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="tool-btn tool-btn--dismiss" data-action="dismiss" data-id="${item.id}" title="Not relevant">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ══════════════════════════════════════════════════════════════════
   13. CARD ACTIONS & AUTO-SYNC
   ══════════════════════════════════════════════════════════════════ */

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeView = btn.dataset.view;
    const titles = { feed: "Personalized Pulse", popular: "Community Popular", recent: "Latest Updates", bookmarks: "Saved Bookmarks" };
    currentViewTitle.textContent = titles[state.activeView] || "Feed";
    renderFeed();
  });
});

typePills.addEventListener("click", (e) => {
  const pill = e.target.closest(".pill-btn");
  if (!pill) return;
  $$(".pill-btn").forEach((p) => p.classList.remove("active"));
  pill.classList.add("active");
  state.activeType = pill.dataset.type;
  renderFeed();
});

sidebarTags.addEventListener("click", (e) => {
  const tagBtn = e.target.closest(".mini-tag");
  if (!tagBtn) return;
  const isSelected = tagBtn.classList.toggle("active");
  searchInput.value = isSelected ? tagBtn.dataset.tag : "";
  state.searchQuery = isSelected ? tagBtn.dataset.tag.toLowerCase() : "";
  renderFeed();
});

searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value.trim().toLowerCase();
  renderFeed();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); }
  if (e.key === "Escape") { closeCardDetail(); closeAuthModal(); }
});

// Card click handler — open detail popup OR handle toolbar actions
cardsContainer.addEventListener("click", (e) => {
  // Handle toolbar button clicks
  const btn = e.target.closest(".tool-btn");
  if (btn) {
    e.stopPropagation();
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "upvote") {
      const isVoted = state.upvotes[`${id}_voted`];
      if (isVoted) { state.upvotes[id] = (state.upvotes[id] || 1) - 1; state.upvotes[`${id}_voted`] = false; }
      else { state.upvotes[id] = (state.upvotes[id] || 0) + 1; state.upvotes[`${id}_voted`] = true; }
      localStorage.setItem("nabdh_upvotes", JSON.stringify(state.upvotes));
      renderFeed();
    } else if (action === "bookmark") {
      if (state.bookmarks.has(id)) state.bookmarks.delete(id); else state.bookmarks.add(id);
      localStorage.setItem("nabdh_bookmarks", JSON.stringify([...state.bookmarks]));
      renderFeed();
    } else if (action === "dismiss") {
      state.feedback = state.feedback.filter((f) => f.itemId !== id);
      state.feedback.push({ itemId: id, relevant: false });
      btn.closest(".nabdh-card").classList.add("dismissed");
      aiStatusMessage.textContent = "Feedback received — re-ranking...";
      setTimeout(() => rankFeed(), 600);
    }
    return;
  }

  // Handle card title click — open detail popup
  const titleLink = e.target.closest("[data-card-click]");
  if (titleLink) {
    e.preventDefault();
    const itemId = titleLink.dataset.cardClick;
    const item = state.rankedFeed.find((it) => it.id === itemId);
    if (item) openCardDetail(item);
    return;
  }

  // Handle click on the card itself (not on buttons)
  const card = e.target.closest(".nabdh-card");
  if (card && !e.target.closest("a") && !e.target.closest("button")) {
    const itemId = card.dataset.id;
    const item = state.rankedFeed.find((it) => it.id === itemId);
    if (item) openCardDetail(item);
  }
});

manualRefreshBtn.addEventListener("click", async () => {
  state.countdown = state.profile.refreshInterval;
  await rankFeed();
});

function startAutoSync() {
  stopAutoSync();
  const interval = state.profile.refreshInterval;
  state.countdown = interval;
  const circumference = 2 * Math.PI * 16;

  state.countdownTimer = setInterval(() => {
    state.countdown--;
    if (state.countdown < 0) state.countdown = 0;
    syncCountdownText.textContent = state.countdown;
    const progress = 1 - state.countdown / interval;
    syncProgressBar.style.strokeDashoffset = circumference * (1 - progress);
  }, 1000);

  state.refreshTimer = setInterval(async () => {
    state.countdown = interval;
    await rankFeed();
  }, interval * 1000);
}

function stopAutoSync() {
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  if (state.refreshTimer) clearInterval(state.refreshTimer);
}

function formatDate(dateStr) {
  if (!dateStr) return "Recent";
  try { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  catch { return dateStr; }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
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
