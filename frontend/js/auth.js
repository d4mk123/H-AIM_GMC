/* ══════════════════════════════════════════════════════════════════
   5. AUTH & SCREEN TRANSITIONS
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