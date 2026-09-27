/* ══════════════════════════════════════════════════════════════════
   6. GEMINI AI RANKING
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