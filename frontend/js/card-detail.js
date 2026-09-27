/* ══════════════════════════════════════════════════════════════════
   7. CARD DETAIL POPUP
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