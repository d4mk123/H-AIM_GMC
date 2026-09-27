/* ══════════════════════════════════════════════════════════════════
   6. BACKEND AI RANKING (POST /rank)
   The model call happens on the server, where the API key lives.
   ══════════════════════════════════════════════════════════════════ */

// Item tags are short slugs (ai, cloud, startups) while profile interests are
// readable labels ("AI & Machine Learning"). Map the labels back to tags so the
// server's exact-match pre-filter actually selects the closest items; the raw
// labels are still sent for the model to reason about.
const SEED_TAGS = ["ai", "ml", "cloud", "fintech", "cybersecurity", "data engineering", "startups"];

function interestsToTags(interests) {
  const out = new Set();
  for (const raw of interests || []) {
    const label = String(raw).toLowerCase().trim();
    if (!label) continue;
    for (const tag of SEED_TAGS) {
      if (label.includes(tag) || tag.includes(label)) out.add(tag);
    }
    if (label.includes("machine learning") || label.includes("data science")) out.add("ml");
    if (label.includes("data")) out.add("data engineering");
  }
  return [...out];
}

function buildRankRequestBody(profile) {
  const labels = Array.isArray(profile.interests) ? profile.interests : [];
  return {
    profile: {
      name: [profile.name, profile.surname].filter(Boolean).join(" ") || null,
      occupation: profile.occupation || null,
      interests: [...new Set([...labels, ...interestsToTags(labels)])],
    },
  };
}

async function callRankApi(profile) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRankRequestBody(profile)),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`rank endpoint responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function rankFeed() {
  if (state.isRanking) return;
  state.isRanking = true;
  aiStatusMessage.textContent = "AI reasoning over your profile...";

  try {
    const data = await callRankApi(state.profile);
    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("rank endpoint returned no items");
    }

    // Keep our own item objects (link/date/description) and attach the scores.
    const itemMap = new Map(state.items.map((it) => [it.id, it]));
    const result = data.items
      .filter((r) => itemMap.has(r.id))
      .map((r) => ({ ...itemMap.get(r.id), score: r.score, reason: r.reason }));
    for (const item of state.items) {
      if (!result.find((r) => r.id === item.id)) {
        result.push({ ...item, score: 5, reason: "Not directly related to your current focus" });
      }
    }
    state.rankedFeed = result;

    if (data.source === "model") {
      aiStatusMessage.textContent = `Ranked by AI for ${state.profile.name}`;
      aiModelTag.textContent = data.model || "backend-model";
    } else {
      aiStatusMessage.textContent = "Tag-based ranking (AI unavailable)";
      aiModelTag.textContent = data.fallbackReason || "backend-fallback";
    }
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
