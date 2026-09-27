/* ══════════════════════════════════════════════════════════════════
   8. FEED RENDERING, ACTIONS & AUTO-SYNC
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

function renderFeed() {
  const briefView = document.getElementById('brief-view');
  if (briefView) briefView.classList.add('hidden');
  if (cardsContainer) cardsContainer.classList.remove('hidden');
  if (state.activeView === "brief") { renderBrief(); return; }
  let displayList = [...(state.searchedItems.length ? state.searchedItems : state.rankedFeed)];

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
            <span class="ai-reason-pill__text">${escapeHtml(item.reason)}</span>${item.score != null ? `<span class="ai-score-tag">${item.score}%</span>` : ""}
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

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeView = btn.dataset.view;
    const titles = { feed: "Personalized Pulse", popular: "Community Popular", recent: "Latest Updates", bookmarks: "Saved Bookmarks", brief: "Weekly Brief" };
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

let searchTimer = null;
searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value.trim().toLowerCase();
  clearTimeout(searchTimer);
  if (!state.searchQuery) { state.searchedItems = []; renderFeed(); return; }
  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/search?q=${encodeURIComponent(state.searchQuery)}&type=${state.activeType}&limit=20`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.searchedItems = (data.items || []).map((it) => ({
        ...it,
        description: it.summary || "",
        date: it.publishedAt ? String(it.publishedAt).slice(0, 10) : "",
        summary: it.summary || "",
      }));
    } catch {
      state.searchedItems = [];
    }
    renderFeed();
  }, 250);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); }
  if (e.key === "Escape") { closeCardDetail(); closeAuthModal(); }
});

cardsContainer.addEventListener("click", (e) => {
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

  const titleLink = e.target.closest("[data-card-click]");
  if (titleLink) {
    e.preventDefault();
    const itemId = titleLink.dataset.cardClick;
    const item = state.rankedFeed.find((it) => it.id === itemId);
    if (item) openCardDetail(item);
    return;
  }

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

/* ── Weekly brief ────────────────────────────── */
async function loadBrief() {
  const btn = document.getElementById('brief-load-btn');
  if (btn) { btn.textContent = "Generating…"; btn.disabled = true; }
  try {
    const res = await fetch('/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: { id: state.profile.id || 'web-local', ...buildRankRequestBody(state.profile).profile }, force: true }),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.brief = data.brief;
    renderBrief();
  } catch (err) {
    console.error('Brief failed:', err);
    state.brief = null;
    renderBrief();
  }
}

function renderBrief() {
  const container = document.getElementById('brief-view');
  if (!container) return;
  const b = state.brief;
  if (!b) {
    container.innerHTML = `<div class="widget-card"><div class="widget-header"><div class="widget-title"><svg class="widget-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>Weekly Brief</div></div><p style="color:var(--text-dim);font-size:0.85rem;padding:0.6rem 0">A tailored plan for the week ahead, built from this week's feed.</p><button id="brief-load-btn" class="btn-primary">Generate this week's brief</button></div>`;
    document.getElementById('brief-load-btn').onclick = loadBrief;
    container.classList.remove('hidden');
    cardsContainer.classList.add('hidden');
    return;
  }
  const trends = (b.trends || []).map((t) =>
    `<div class="trending-item"><div><div class="trend-tag">${escapeHtml(t.tag)}</div><div class="trend-reads">${t.mentions} mentions</div></div><div class="trend-delta">trending</div></div>`
  ).join('');
  const skills = (b.skills || []).map((s) => {
    const roadmap = (s.roadmap || []).map((step, j) =>
      `<div class="roadmap-step${j === 0 ? ' current' : ''}"><div class="step-marker">${j + 1}</div><div class="step-card"><h4>${escapeHtml(step)}</h4></div></div>`
    ).join('');
    const todos = (s.checklist || []).map((t, j) =>
      `<div class="todo-item"><input type="checkbox" class="todo-checkbox"${j === 0 ? ' checked disabled' : ''}><span class="todo-text">${escapeHtml(t)}</span></div>`
    ).join('');
    return `<div class="roadmap-wrapper"><div class="roadmap-header"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.why)}</p></div><div class="roadmap-timeline">${roadmap}</div><div class="todo-wrapper" style="margin-top:0.75rem"><div class="todo-header"><h3>Checklist</h3><span class="todo-progress-indicator">${s.checklist.length} tasks</span></div><div class="todo-items-list">${todos}</div></div></div>`;
  }).join('');
  container.innerHTML = `<div class="widget-card"><div class="widget-header"><div class="widget-title"><svg class="widget-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>Weekly Brief</div></div></div>
  <div class="widget-card" style="margin-top:1rem"><div class="widget-header"><div class="widget-title">This week for ${escapeHtml(state.profile.name || 'you')}</div></div><p style="font-size:0.95rem;color:#fff;padding:0.6rem 0">${escapeHtml(b.headline)}</p><div class="trending-list" style="margin-top:0.5rem">${trends}</div></div>
  <div class="widget-card" style="margin-top:1rem"><div class="widget-header"><div class="widget-title">Skills to build this week</div></div><div class="roadmap-wrapper" style="margin-top:0.75rem">${skills}</div></div>`;
  container.classList.remove('hidden');
  cardsContainer.classList.add('hidden');
}