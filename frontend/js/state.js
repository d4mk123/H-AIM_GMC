/* ══════════════════════════════════════════════════════════════════
   2. APPLICATION STATE
   ══════════════════════════════════════════════════════════════════ */
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
  searchedItems: [],
  brief: null,
  isRanking: false,
  countdown: 25,
  countdownTimer: null,
  refreshTimer: null,
};