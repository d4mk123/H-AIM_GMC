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
const GEMINI_API_KEY = "--";
const GEMINI_MODEL = "--";

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
const registerForm      = $("#register-form");
const btnFinishRegister = $("#btn-finish-register");
const loginForm         = $("#login-form");

// CV Upload elements
const cvZone            = $("#cv-upload-zone");
const cvFileInput       = $("#reg-cv-file");
const cvUploadContent   = $("#cv-upload-content");
const cvFilePreview     = $("#cv-file-preview");
const cvFilename        = $("#cv-filename");
const cvFilesize        = $("#cv-filesize");
const btnRemoveCv       = $("#btn-remove-cv");

const demoStudentLogin  = $("#demo-student-login");
const demoCloudLogin    = $("#demo-cloud-login");

const navItems          = $$(".nav-item");
const feedCountBadge    = $("#feed-count-badge");
const bookmarkCountBadge= $("#bookmark-count-badge");
const sidebarTags       = $("#sidebar-tags");
const userNameDisplay   = $("#user-name-display");
const userRoleDisplay   = $("#user-role-display");
const userAvatarInitial = $("#user-avatar-initial");

// Profile Popover & Configuration Modal Elements
const userProfileWidget     = $("#user-profile-widget");
const profilePopoverMenu    = $("#profile-popover-menu");
const profileConfigOverlay  = $("#profile-config-overlay");
const configCloseBtn        = $("#config-close-btn");
const configCancelBtn       = $("#config-cancel-btn");
const configSaveBtn         = $("#config-save-btn");
const configTabBtns         = $$(".config-tab-btn");
const configPanels          = $$(".config-panel");
const popoverLogoutBtn      = $("#popover-logout-btn");
const themeSegBtns          = $$(".theme-seg-btn");
const popoverFeedbackToggle = $("#popover-feedback-toggle");
const nabdhToast            = $("#nabdh-toast");
const nabdhToastText        = $("#nabdh-toast-text");
const cfgUploadCvTrigger    = $("#cfg-upload-cv-trigger");
const cfgCvFileInput        = $("#cfg-cv-file-input");
const cfgCurrentCvName      = $("#cfg-current-cv-name");
const cfgCurrentCvSize      = $("#cfg-current-cv-size");
const quickLogoutBtn    = $("#quick-logout-btn");
const exitToWelcomeBtn  = $("#exit-to-welcome-btn");

// AI Brief & Copilot Modal Elements
const openAiBriefBtn        = $("#open-ai-brief-btn");
const aiBriefOverlay        = $("#ai-brief-overlay");
const aiBriefCloseBtn       = $("#ai-brief-close-btn");
const aiTabBtns             = $$(".ai-tab-btn");
const aiPanels              = $$(".ai-panel");
const btnRefreshAiBrief     = $("#btn-refresh-ai-brief");
const aiBriefSawTitle       = $("#ai-brief-saw-title");
const aiBriefSawText        = $("#ai-brief-saw-text");
const aiBriefTags           = $("#ai-brief-tags");
const aiBriefWorldTitle     = $("#ai-brief-world-title");
const aiBriefWorldText      = $("#ai-brief-world-text");
const aiBriefAdviceTitle    = $("#ai-brief-advice-title");
const aiBriefAdviceText     = $("#ai-brief-advice-text");
const aiTodoList            = $("#ai-todo-list");
const aiTodoAddForm         = $("#ai-todo-add-form");
const aiTodoInput           = $("#ai-todo-input");
const todoProgressText      = $("#todo-progress-text");
const aiChatForm            = $("#ai-chat-form");
const aiChatInput           = $("#ai-chat-input");
const aiChatMessages        = $("#ai-chat-messages");

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
   6. TECH INTEREST TAGS & SMART RECOMMENDATIONS (Inline Spawning)
   ══════════════════════════════════════════════════════════════════ */
function initRegisterInterestGrid() {
  const container = regInterestGrid;
  if (!container) return;

  container.innerHTML = INTEREST_OPTIONS.map((opt) =>
    `<button type="button" class="tag-chip" data-interest="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
  ).join("");

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".tag-chip");
    if (!chip) return;

    // If it's an inline recommendation chip, toggle its selected state
    if (chip.classList.contains("recommendation-chip")) {
      chip.classList.toggle("selected");
      return;
    }

    // It's a primary interest tag chip
    const interestName = chip.dataset.interest;
    const isSelected = chip.classList.toggle("selected");

    if (isSelected) {
      spawnRecommendationsFor(chip, interestName);
    } else {
      removeRecommendationsFor(interestName);
    }
  });
}

function spawnRecommendationsFor(chip, interestName) {
  const recs = INTEREST_RECOMMENDATIONS[interestName];
  if (!recs || recs.length === 0) return;

  // Clean any existing recommendation chips for this interest
  removeRecommendationsFor(interestName);

  // Spawn each recommendation tag chip immediately to the right of the clicked chip (in the same row, after it)
  let insertCursor = chip;
  recs.forEach((rec) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-chip recommendation-chip";
    btn.dataset.interest = rec;
    btn.dataset.parent = interestName;
    btn.textContent = `+ ${rec}`;
    insertCursor.insertAdjacentElement("afterend", btn);
    insertCursor = btn;
  });
}

function removeRecommendationsFor(interestName) {
  const parentEscaped = CSS && CSS.escape ? CSS.escape(interestName) : interestName.replace(/["\\]/g, '\\$&');
  const existing = document.querySelectorAll(`.recommendation-chip[data-parent="${parentEscaped}"]`);
  existing.forEach((el) => el.remove());
}

function getSelectedInterests() {
  const interests = [];
  document.querySelectorAll("#reg-interest-grid .tag-chip.selected").forEach((btn) => {
    let val = btn.dataset.interest || btn.textContent.trim();
    val = val.replace(/^\+\s*/, "").trim();
    if (val && !interests.includes(val)) {
      interests.push(val);
    }
  });
  return { interests, skillLevels: {} };
}

/* ── CV / Resume Upload Handler (Strictly PDF) ────────────── */
function initCvUpload() {
  if (!cvZone || !cvFileInput) return;

  function handleCvFile(file) {
    if (!file) return;

    // Strict PDF validation check
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("Invalid format: Please upload a PDF file (.pdf) only.");
      cvFileInput.value = "";
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit.");
      cvFileInput.value = "";
      return;
    }

    let sizeStr = (file.size / 1024).toFixed(1) + " KB";
    if (file.size > 1024 * 1024) {
      sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    }

    state.profile.cvName = file.name;
    state.profile.cvSize = sizeStr;
    state.profile.hasCv = true;

    if (cvFilename) cvFilename.textContent = file.name;
    if (cvFilesize) cvFilesize.textContent = sizeStr;
    if (cvUploadContent) cvUploadContent.style.display = "none";
    if (cvFilePreview) cvFilePreview.style.display = "flex";
  }

  cvZone.addEventListener("click", (e) => {
    if (e.target.closest("#btn-remove-cv")) return;
    if (cvFilePreview && cvFilePreview.style.display === "flex") return;
    cvFileInput.click();
  });

  cvFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleCvFile(e.target.files[0]);
    }
  });

  cvZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    cvZone.classList.add("dragover");
  });

  cvZone.addEventListener("dragleave", () => {
    cvZone.classList.remove("dragover");
  });

  cvZone.addEventListener("drop", (e) => {
    e.preventDefault();
    cvZone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCvFile(e.dataTransfer.files[0]);
    }
  });

  if (btnRemoveCv) {
    btnRemoveCv.addEventListener("click", (e) => {
      e.stopPropagation();
      cvFileInput.value = "";
      state.profile.cvName = "";
      state.profile.cvSize = "";
      state.profile.hasCv = false;
      if (cvUploadContent) cvUploadContent.style.display = "flex";
      if (cvFilePreview) cvFilePreview.style.display = "none";
    });
  }
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
  state.profile.cvName = state.profile.cvName || "";
  state.profile.cvSize = state.profile.cvSize || "";
  state.profile.hasCv = !!state.profile.hasCv;
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
    state.items = await res.json();
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
  renderTrending(TRENDING_TOPICS);
  renderUpcomingEvents();
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

function getCardAvatarSvg(type) {
  if (type === "job") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
  } else if (type === "internship") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
  } else if (type === "event") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  } else {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="18" y2="14"/></svg>`;
  }
}

function formatPhotoDate(dateStr) {
  if (!dateStr) return "17 Sept";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
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

    let matchHeadline = "Matches your focus on backend";
    if (item.reason && item.reason.trim()) {
      matchHeadline = item.reason.trim();
    } else if (item.tags && item.tags.length > 0) {
      matchHeadline = `Matches your focus on ${item.tags[0].toLowerCase()}`;
    } else {
      matchHeadline = `Matches your focus on ${item.type || 'tech'}`;
    }

    // Clean concise title without redundant suffixes
    let cleanTitle = item.title;
    if (cleanTitle.includes(" — ")) {
      const parts = cleanTitle.split(" — ");
      if (parts[0].length >= 8) cleanTitle = parts[0];
    }

    const locPart = item.location ? item.location.split(',')[0].trim() : "Tunis";

    return `
      <article class="nabdh-card ${isDismissed ? "dismissed" : ""}" data-id="${item.id}">
        <!-- Top Author / Company Header -->
        <div class="card-header">
          <div class="card-avatar-box">
            ${getCardAvatarSvg(item.type)}
          </div>
          <div class="card-author-meta">
            <div class="card-author-line">
              <span class="card-company-name">${escapeHtml(item.source || "Tunisia Tech")}</span>
              <span class="verified-badge-circle" title="Verified">&#10003;</span>
            </div>
            <div class="card-sub-meta">
              <span>📍 ${escapeHtml(locPart)}</span>
              <span class="meta-dot">•</span>
              <span>📅 ${formatPhotoDate(item.date)}</span>
            </div>
          </div>
          <span class="card-type-pill card-type-pill--${item.type}">${item.type}</span>
        </div>

        <!-- Crisp Pro Title -->
        <h2 class="card-title">
          <a href="javascript:void(0)" class="card-title-link" data-card-click="${item.id}">${escapeHtml(cleanTitle)}</a>
        </h2>

        <!-- Clean Summary -->
        <p class="card-summary">${escapeHtml(item.description)}</p>

        <!-- Rounded Pill Tags -->
        ${item.tags && item.tags.length > 0 ? `
          <div class="card-tags-row">
            ${item.tags.map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ""}

        <!-- Photo-Matching AI Match Equalizer Banner -->
        <div class="card-match-banner" data-card-click="${item.id}">
          <div class="match-banner-left">
            <div class="match-bars-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <line x1="6" y1="20" x2="6" y2="13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                <line x1="12" y1="20" x2="12" y2="7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                <line x1="18" y1="20" x2="18" y2="11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="match-banner-text">
              <div class="match-title">${escapeHtml(matchHeadline)}</div>
              <div class="match-score-text">${item.score != null ? `${item.score}% match` : "50% match"}</div>
            </div>
          </div>
          <div class="match-banner-arrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        <!-- Card Bottom Toolbar -->
        <div class="card-toolbar">
          <div class="toolbar-left">
            <button class="tool-btn tool-btn--upvote ${isUpvoted ? "active" : ""}" data-action="upvote" data-id="${item.id}" title="Upvote">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              <span>${upvoteCount}</span>
            </button>
            <button class="tool-btn tool-btn--comment" data-action="discuss" data-id="${item.id}" title="Discussion">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>${(item.title.length % 7) + 2}</span>
            </button>
          </div>
          <div class="toolbar-right">
            <button class="tool-btn tool-btn--bookmark ${isBookmarked ? "active" : ""}" data-action="bookmark" data-id="${item.id}" title="Bookmark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button class="tool-btn tool-btn--dismiss" data-action="dismiss" data-id="${item.id}" title="Not relevant">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
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
    } else if (action === "discuss") {
      const item = state.rankedFeed.find((it) => it.id === id);
      if (item) openCardDetail(item);
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
   13. PROFILE POPOVER & CONFIGURATION MODAL CONTROLLER
   ══════════════════════════════════════════════════════════════════ */
function showToast(message, duration = 3000) {
  if (!nabdhToast || !nabdhToastText) return;
  nabdhToastText.textContent = message;
  nabdhToast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    nabdhToast.classList.remove("show");
  }, duration);
}

function initProfilePopoverAndConfig() {
  if (!userProfileWidget || !profilePopoverMenu) return;

  // Toggle Popover on User Profile Card Click
  userProfileWidget.addEventListener("click", (e) => {
    e.stopPropagation();
    profilePopoverMenu.classList.toggle("open");
  });

  // Close popover when clicking anywhere else
  document.addEventListener("click", (e) => {
    if (!profilePopoverMenu.contains(e.target) && !userProfileWidget.contains(e.target)) {
      profilePopoverMenu.classList.remove("open");
    }
  });

  // Popover items that open Config Modal tabs
  $$("[data-open-config]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tabName = btn.dataset.openConfig;
      profilePopoverMenu.classList.remove("open");
      openProfileConfig(tabName);
    });
  });

  // Popover Theme Segment Buttons
  themeSegBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const theme = btn.dataset.theme;
      setTheme(theme);
    });
  });

  // Restore saved theme on startup
  const savedTheme = localStorage.getItem("nabdh_theme") || "dark";
  setTheme(savedTheme, false);

  // Popover Feedback Toggle
  if (popoverFeedbackToggle) {
    popoverFeedbackToggle.addEventListener("change", (e) => {
      const active = e.target.checked;
      showToast(active ? "Feedback button enabled" : "Feedback button disabled");
    });
  }

  // Popover Logout Button
  if (popoverLogoutBtn) {
    popoverLogoutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profilePopoverMenu.classList.remove("open");
      localStorage.removeItem("nabdh_user");
      state.user = null;
      returnToWelcome();
      showToast("Logged out successfully");
    });
  }

  // Additional Popover buttons (Changelog, Docs, Support)
  const changelogBtn = $("#popover-changelog-btn");
  if (changelogBtn) {
    changelogBtn.addEventListener("click", () => {
      profilePopoverMenu.classList.remove("open");
      showToast("Nabdh v1.4.0 (Latest hackathon release)");
    });
  }

  const docsBtn = $("#popover-docs-btn");
  if (docsBtn) {
    docsBtn.addEventListener("click", () => {
      profilePopoverMenu.classList.remove("open");
      showToast("Opening Nabdh documentation...");
    });
  }

  const supportBtn = $("#popover-support-btn");
  if (supportBtn) {
    supportBtn.addEventListener("click", () => {
      profilePopoverMenu.classList.remove("open");
      showToast("Nabdh Support: support@nabdh.tn");
    });
  }

  // Config Modal Tabs
  configTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      switchConfigTab(targetTab);
    });
  });

  // Close Config Modal Buttons
  if (configCloseBtn) {
    configCloseBtn.addEventListener("click", closeProfileConfig);
  }
  if (configCancelBtn) {
    configCancelBtn.addEventListener("click", closeProfileConfig);
  }

  // Close Config Modal on Backdrop Click
  if (profileConfigOverlay) {
    profileConfigOverlay.addEventListener("click", (e) => {
      if (e.target === profileConfigOverlay) {
        closeProfileConfig();
      }
    });
  }

  // Close Config Modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && profileConfigOverlay?.classList.contains("open")) {
      closeProfileConfig();
    }
  });

  // Save Config Changes
  if (configSaveBtn) {
    configSaveBtn.addEventListener("click", saveProfileConfig);
  }

  // CV Upload inside Config Modal (Strictly PDF check)
  if (cfgUploadCvTrigger && cfgCvFileInput) {
    cfgUploadCvTrigger.addEventListener("click", () => {
      cfgCvFileInput.click();
    });

    cfgCvFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        showToast("Error: Only PDF files (.pdf) are accepted!");
        cfgCvFileInput.value = "";
        return;
      }

      const formattedSize = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      if (cfgCurrentCvName) cfgCurrentCvName.textContent = file.name;
      if (cfgCurrentCvSize) cfgCurrentCvSize.textContent = `${formattedSize} · PDF document`;

      state.profile.cvName = file.name;
      state.profile.cvSize = `${formattedSize} · PDF document`;
      localStorage.setItem("nabdh_profile", JSON.stringify(state.profile));
      showToast(`CV updated: ${file.name}`);
    });
  }
}

function setTheme(theme, notify = true) {
  themeSegBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });

  let effectiveTheme = theme;
  if (theme === "system") {
    effectiveTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  document.documentElement.setAttribute("data-theme", effectiveTheme);
  localStorage.setItem("nabdh_theme", theme);
  if (notify) {
    showToast(`Theme switched to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
  }
}

function openProfileConfig(tabName = "profile") {
  if (!profileConfigOverlay) return;

  // Populate fields
  const cfgFirstName = $("#cfg-first-name");
  const cfgSurname = $("#cfg-surname");
  const cfgEmail = $("#cfg-email");
  const cfgPhone = $("#cfg-phone");
  const cfgOccupation = $("#cfg-occupation");
  const cfgLocation = $("#cfg-location");
  const cfgBio = $("#cfg-bio");
  const cfgGithub = $("#cfg-github");
  const cfgLinkedin = $("#cfg-linkedin");
  const cfgSyncSelect = $("#cfg-sync-select");

  if (cfgFirstName) cfgFirstName.value = state.profile.name || "";
  if (cfgSurname) cfgSurname.value = state.profile.surname || "";
  if (cfgEmail) cfgEmail.value = state.user?.email || state.profile.email || "ahmed.bensalem@gmail.com";
  if (cfgPhone) cfgPhone.value = state.profile.phone || "+216 29 123 456";
  if (cfgOccupation) cfgOccupation.value = state.profile.occupation || "Full-Stack Developer";
  if (cfgLocation) cfgLocation.value = state.profile.location || "Tunis, Tunisia";
  if (cfgBio) cfgBio.value = state.profile.bio || "Passionate about AI, Cloud computing, and Tunisian tech ecosystem.";
  if (cfgGithub) cfgGithub.value = state.profile.github || "https://github.com/ahmedbensalem";
  if (cfgLinkedin) cfgLinkedin.value = state.profile.linkedin || "https://linkedin.com/in/ahmedbensalem";

  if (state.profile.cvName && cfgCurrentCvName) {
    cfgCurrentCvName.textContent = state.profile.cvName;
    if (cfgCurrentCvSize) cfgCurrentCvSize.textContent = state.profile.cvSize || "PDF document";
  }

  if (cfgSyncSelect) {
    cfgSyncSelect.value = String(state.refreshInterval || 25);
  }

  switchConfigTab(tabName);
  profileConfigOverlay.classList.add("open");
}

function closeProfileConfig() {
  if (profileConfigOverlay) {
    profileConfigOverlay.classList.remove("open");
  }
}

function switchConfigTab(tabName) {
  configTabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  configPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${tabName}`);
  });
}

function saveProfileConfig() {
  const cfgFirstName = $("#cfg-first-name");
  const cfgSurname = $("#cfg-surname");
  const cfgEmail = $("#cfg-email");
  const cfgPhone = $("#cfg-phone");
  const cfgOccupation = $("#cfg-occupation");
  const cfgLocation = $("#cfg-location");
  const cfgBio = $("#cfg-bio");
  const cfgGithub = $("#cfg-github");
  const cfgLinkedin = $("#cfg-linkedin");
  const cfgSyncSelect = $("#cfg-sync-select");

  if (cfgFirstName && cfgFirstName.value.trim()) state.profile.name = cfgFirstName.value.trim();
  if (cfgSurname && cfgSurname.value.trim()) state.profile.surname = cfgSurname.value.trim();
  if (cfgEmail && cfgEmail.value.trim()) state.profile.email = cfgEmail.value.trim();
  if (cfgPhone) state.profile.phone = cfgPhone.value.trim();
  if (cfgOccupation && cfgOccupation.value.trim()) state.profile.occupation = cfgOccupation.value.trim();
  if (cfgLocation) state.profile.location = cfgLocation.value.trim();
  if (cfgBio) state.profile.bio = cfgBio.value.trim();
  if (cfgGithub) state.profile.github = cfgGithub.value.trim();
  if (cfgLinkedin) state.profile.linkedin = cfgLinkedin.value.trim();

  if (cfgSyncSelect) {
    const newInterval = parseInt(cfgSyncSelect.value, 10);
    if (newInterval && newInterval !== state.refreshInterval) {
      state.refreshInterval = newInterval;
      startAutoSync(newInterval);
    }
  }

  // Update App Header / Sidebar Displays
  const initials = `${state.profile.name.charAt(0)}${state.profile.surname.charAt(0)}`.toUpperCase();
  if (userAvatarInitial) userAvatarInitial.textContent = initials || "TN";
  if (userNameDisplay) userNameDisplay.textContent = `${state.profile.name} ${state.profile.surname}`;
  if (userRoleDisplay) userRoleDisplay.textContent = state.profile.occupation;

  // Persist
  localStorage.setItem("nabdh_profile", JSON.stringify(state.profile));

  closeProfileConfig();
  showToast("Profile settings updated successfully!");
}

/* ══════════════════════════════════════════════════════════════════
   13b. DETAILED LANDING FEATURE CARDS INTERACTION
   ══════════════════════════════════════════════════════════════════ */
function initLandingFeatureCards() {
  const cards = $$(".feature-detail-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const title = card.querySelector(".feature-card-title")?.textContent || "";
      if (title.includes("Events")) {
        state.activeType = "event";
      } else if (title.includes("AI")) {
        state.searchQuery = "ai";
      } else if (title.includes("Cloud")) {
        state.searchQuery = "cloud";
      } else if (title.includes("DevOps")) {
        state.searchQuery = "devops";
      } else if (title.includes("Cyber")) {
        state.searchQuery = "cybersec";
      }
      welcomeSignupBtn.click();
    });
  });
}

/* ══════════════════════════════════════════════════════════════════
   13c. AI TECH BRIEF & CAREER COPILOT
   ══════════════════════════════════════════════════════════════════ */
let aiTodoListData = [];

function initAiBriefAndCopilot() {
  if (!openAiBriefBtn || !aiBriefOverlay) return;

  // Open modal
  openAiBriefBtn.addEventListener("click", () => {
    aiBriefOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
    generateAiFeedBrief(false);
  });

  // Close modal button
  if (aiBriefCloseBtn) {
    aiBriefCloseBtn.addEventListener("click", () => {
      closeAiBriefModal();
    });
  }

  // Close on outside click
  aiBriefOverlay.addEventListener("click", (e) => {
    if (e.target === aiBriefOverlay) {
      closeAiBriefModal();
    }
  });

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && aiBriefOverlay.classList.contains("open")) {
      closeAiBriefModal();
    }
  });

  // Tab switching
  aiTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-aitab");
      aiTabBtns.forEach((b) => b.classList.remove("active"));
      aiPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = $(`#ai-panel-${tabId}`);
      if (targetPanel) targetPanel.classList.add("active");
    });
  });

  // Re-analyze button
  if (btnRefreshAiBrief) {
    btnRefreshAiBrief.addEventListener("click", () => {
      generateAiFeedBrief(true);
    });
  }

  // Initialize To-Do List & Chat
  initAiTodoList();
  initAiChat();
}

function closeAiBriefModal() {
  if (!aiBriefOverlay) return;
  aiBriefOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

async function generateAiFeedBrief(forceRefresh = false) {
  if (!aiBriefSawTitle || !aiBriefSawText) return;

  // Visual loading feedback on refresh button
  if (btnRefreshAiBrief) {
    btnRefreshAiBrief.disabled = true;
    btnRefreshAiBrief.innerHTML = `
      <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span>Analyzing feed...</span>
    `;
  }

  // Collect feed items
  const feedPool = (state.rankedFeed && state.rankedFeed.length > 0) ? state.rankedFeed : state.items;
  const recentItems = feedPool.slice(0, 8);

  // Compute tag breakdown
  const tagCounts = {};
  let totalTags = 0;
  recentItems.forEach((item) => {
    (item.tags || []).forEach((t) => {
      const tagLower = t.toLowerCase();
      tagCounts[tagLower] = (tagCounts[tagLower] || 0) + 1;
      totalTags++;
    });
  });

  // Top tags render
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (aiBriefTags && sortedTags.length > 0) {
    aiBriefTags.innerHTML = sortedTags
      .map(([tag, count]) => {
        const pct = Math.round((count / (totalTags || 1)) * 100);
        return `<span class="ai-chip">#${tag} (${pct}%)</span>`;
      })
      .join("");
  }

  const titles = recentItems.map((i) => `"${i.title}" (${(i.tags || []).join(", ")})`).join("; ");
  const userRole = state.profile.occupation || "Software Engineer";
  const userInterests = (state.profile.interests || ["AI", "Fullstack", "Cloud"]).join(", ");

  const systemPrompt = `You are the Nabdh AI Tech Analyst for Tunisian tech professionals. 
Analyze the provided user feed and generate a concise 3-part structured JSON:
1. "saw_title": A sharp 5-9 word headline summarizing the core theme of what they just viewed.
2. "saw_text": A crisp 2-3 sentence synthesis of what was viewed in the feed, highlighting technical topics (e.g. AI, cloud, local hackathons, Tunisian companies).
3. "world_title": A sharp 5-9 word headline on how this connects to global tech + Tunisian tech landscape.
4. "world_text": A crisp 2-3 sentence analysis of macro tech trends (e.g., lightweight LLMs, sovereign cloud, remote engineering demand in Tunisia/Europe).
5. "advice_title": A sharp headline for actionable advice.
6. "advice_text": A crisp 2-3 sentence strategic career advice tailored for a ${userRole} interested in ${userInterests}.

Return ONLY valid JSON matching this schema:
{
  "saw_title": string,
  "saw_text": string,
  "world_title": string,
  "world_text": string,
  "advice_title": string,
  "advice_text": string
}`;

  const userPrompt = `USER PROFILE:
Role: ${userRole}
Interests: ${userInterests}

ITEMS IN FEED:
${titles}`;

  try {
    const raw = await callGeminiAPI(systemPrompt, userPrompt);
    const parsed = JSON.parse(raw);
    if (parsed.saw_title) aiBriefSawTitle.textContent = parsed.saw_title;
    if (parsed.saw_text) aiBriefSawText.textContent = parsed.saw_text;
    if (parsed.world_title) aiBriefWorldTitle.textContent = parsed.world_title;
    if (parsed.world_text) aiBriefWorldText.textContent = parsed.world_text;
    if (parsed.advice_title) aiBriefAdviceTitle.textContent = parsed.advice_title;
    if (parsed.advice_text) aiBriefAdviceText.textContent = parsed.advice_text;
  } catch (err) {
    console.warn("AI Feed Brief fallback used:", err);
    // Intelligent contextual fallback
    const topTag = sortedTags[0] ? sortedTags[0][0].toUpperCase() : "AI & CLOUD";
    aiBriefSawTitle.textContent = `Deep Dive: ${topTag} & Modern Infrastructure in Tunisia`;
    aiBriefSawText.textContent = `Your feed spotlighted practical ${userInterests} engineering, cloud deployments across Tunisian companies (Vermeg, Telnet, Expensya alumni), and upcoming student hackathons at INSAT & ESPRIT.`;
    aiBriefWorldTitle.textContent = "Open-Source LLMs, Edge AI & Cloud Sovereignity";
    aiBriefWorldText.textContent = "Globally, lightweight reasoning models like Gemini 2.0 Flash are democratizing AI integration into web apps. In Tunisia, demand is surging for engineers capable of bridging modern full-stack with intelligent AI microservices.";
    aiBriefAdviceTitle.textContent = `Strategic 30-Day Plan for ${state.profile.name || "You"}`;
    aiBriefAdviceText.textContent = `Double down on containerizing AI workflows using Docker and FastAPI. Build one high-visibility portfolio project tailored to local Tunisian datasets or Darija NLP to catch tech recruiters' attention.`;
  } finally {
    if (btnRefreshAiBrief) {
      btnRefreshAiBrief.disabled = false;
      btnRefreshAiBrief.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        <span>Re-analyze Feed</span>
      `;
    }
  }
}

/* ── To-Do List Management ────────────────────────────────── */
function initAiTodoList() {
  const saved = localStorage.getItem("nabdh_ai_todos");
  if (saved) {
    try {
      aiTodoListData = JSON.parse(saved);
    } catch (e) {
      aiTodoListData = [];
    }
  }

  if (!aiTodoListData || aiTodoListData.length === 0) {
    aiTodoListData = [
      { id: "td1", text: "Integrate Gemini 2.0 Flash API in a test sandbox project", done: false },
      { id: "td2", text: "Containerize web application using a multi-stage Dockerfile", done: true },
      { id: "td3", text: "RSVP for the upcoming INSAT AI & Cloud Hackathon", done: false },
      { id: "td4", text: "Publish an open-source Darija NLP or Tunisian Tech repository on GitHub", done: false },
      { id: "td5", text: "Optimize fullstack CI/CD pipeline using GitHub Actions", done: false }
    ];
    saveAiTodoList();
  }

  renderAiTodoList();

  if (aiTodoAddForm && aiTodoInput) {
    aiTodoAddForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = aiTodoInput.value.trim();
      if (!val) return;
      aiTodoListData.push({
        id: "td_" + Date.now(),
        text: val,
        done: false
      });
      aiTodoInput.value = "";
      saveAiTodoList();
      renderAiTodoList();
    });
  }
}

function saveAiTodoList() {
  localStorage.setItem("nabdh_ai_todos", JSON.stringify(aiTodoListData));
}

function renderAiTodoList() {
  if (!aiTodoList) return;
  aiTodoList.innerHTML = "";

  const completedCount = aiTodoListData.filter((t) => t.done).length;
  if (todoProgressText) {
    todoProgressText.textContent = `${completedCount} of ${aiTodoListData.length} completed`;
  }

  aiTodoListData.forEach((item) => {
    const el = document.createElement("div");
    el.className = `todo-item ${item.done ? "done" : ""}`;
    el.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${item.done ? "checked" : ""} aria-label="Mark task done" />
      <span class="todo-text">${escapeHtml(item.text)}</span>
      <button type="button" class="todo-delete-btn" title="Delete task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const checkbox = el.querySelector(".todo-checkbox");
    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      saveAiTodoList();
      renderAiTodoList();
    });

    const deleteBtn = el.querySelector(".todo-delete-btn");
    deleteBtn.addEventListener("click", () => {
      aiTodoListData = aiTodoListData.filter((t) => t.id !== item.id);
      saveAiTodoList();
      renderAiTodoList();
    });

    aiTodoList.appendChild(el);
  });
}

/* ── Interactive Copilot Chat ─────────────────────────────── */
function initAiChat() {
  if (!aiChatForm || !aiChatInput || !aiChatMessages) return;

  aiChatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = aiChatInput.value.trim();
    if (!query) return;
    aiChatInput.value = "";
    await sendAiChatMessage(query);
  });

  const suggestions = $$(".chat-suggest-btn");
  suggestions.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const q = btn.getAttribute("data-query") || btn.textContent.trim();
      await sendAiChatMessage(q);
    });
  });
}

async function sendAiChatMessage(query) {
  // Append user message
  appendChatMessage("user", query);

  // Append AI typing bubble
  const typingId = "ai-typing-" + Date.now();
  const typingBubble = document.createElement("div");
  typingBubble.className = "chat-msg ai-msg";
  typingBubble.id = typingId;
  typingBubble.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-bubble">
      <div class="ai-typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  aiChatMessages.appendChild(typingBubble);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  // Build context
  const userRole = state.profile.occupation || "Developer";
  const userInterests = (state.profile.interests || ["AI", "Tech"]).join(", ");
  const feedHeadlines = (state.rankedFeed || state.items || []).slice(0, 5).map((i) => i.title).join("; ");

  const systemInstruction = `You are Nabdh AI Copilot, an elite technical advisor and career mentor for Tunisian tech professionals, students, and engineers.
Context:
- User is: ${userRole}, interested in ${userInterests}.
- Recent feed highlights: ${feedHeadlines}.
- Focus on practical, actionable advice, clear code/architectural suggestions, and realistic opportunities in Tunisia and remote tech.
- Format responses cleanly using short paragraphs and bullet points.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: query }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200, topP: 0.95 }
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to formulate a response. Please try again.";

    // Remove typing bubble and append AI reply
    const el = document.getElementById(typingId);
    if (el) el.remove();
    appendChatMessage("ai", replyText);
  } catch (err) {
    console.warn("AI Chat error:", err);
    const el = document.getElementById(typingId);
    if (el) el.remove();
    appendChatMessage("ai", `I'm currently operating in offline mode. Here is a quick insight on your question:
- For **${escapeHtml(query)}**: Focus on combining clean full-stack fundamentals (Next.js/FastAPI) with containerized deployment (Docker) and exploring open-source AI integrations. Check the **Roadmap** and **Action To-Do List** tabs for your immediate next steps!`);
  }
}

function appendChatMessage(role, text) {
  if (!aiChatMessages) return;
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${role === "user" ? "user-msg" : "ai-msg"}`;

  // Simple formatting for bold, bullets, and linebreaks
  const formatted = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\s*-\s*(.*?)(?=\n|$)/g, "<li>$1</li>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");

  msgEl.innerHTML = `
    <div class="msg-avatar">${role === "user" ? (state.profile.name ? state.profile.name[0].toUpperCase() : "U") : "AI"}</div>
    <div class="msg-bubble">
      <p>${formatted}</p>
    </div>
  `;
  aiChatMessages.appendChild(msgEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

/* ══════════════════════════════════════════════════════════════════
   14. BOOTSTRAP
   ══════════════════════════════════════════════════════════════════ */
initCustomSelects();
initRegisterInterestGrid();
initCvUpload();
initProfilePopoverAndConfig();
initLandingFeatureCards();
initAiBriefAndCopilot();

// Restore profile data into memory if saved, but ALWAYS show the welcome/home page first on refresh
const savedProfile = JSON.parse(localStorage.getItem("nabdh_profile") || "null");
if (savedProfile) {
  Object.assign(state.profile, savedProfile);
}

welcomePage.classList.add("active");
appLayout.classList.remove("active");
window.scrollTo(0, 0);
