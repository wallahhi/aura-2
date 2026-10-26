/**
 * AURA History View Component.
 * Implements Screen 3 from Stitch Reference:
 * - Sound History Header & Private & Local badge
 * - Today's Acoustic Summary card with segmented progress bar and event breakdown
 * - On-Device classification privacy callout
 * - Filter pills (All, Critical, Caution, Notice, Info)
 * - Grouped timeline list (Today, Yesterday) with full direction, dB, and confidence metadata
 */

import { appState } from "../state.js";

export function initHistoryView(container) {
  function getIconSvg(iconName) {
    switch (iconName) {
      case "alarm":
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="2" y1="4" x2="4" y2="2"></line><line x1="22" y1="4" x2="20" y2="2"></line></svg>`;
      case "doorbell":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
      case "paw":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="4" r="2"></circle><circle cx="18" cy="8" r="2"></circle><circle cx="4" cy="8" r="2"></circle><path d="M12 19c-3.3 0-6-2-6-5 0-3 2.5-4 6-4s6 1 6 4c0 3-2.7 5-6 5z"></path></svg>`;
      case "water":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;
      case "car":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="9" rx="2"></rect><path d="M5 11l2-6h10l2 6"></path><circle cx="7.5" cy="16.5" r="1.5"></circle><circle cx="16.5" cy="16.5" r="1.5"></circle></svg>`;
      case "speech":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
      case "timer":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
      case "knock":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v5"></path><path d="M14 10V4a2 2 0 0 0-4 0v7"></path><path d="M10 10.5V6a2 2 0 0 0-4 0v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>`;
      case "clap":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;
      case "whistle":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="14" cy="14" r="7"></circle><path d="M14 7V3h-4v4"></path><path d="M2 10h5l3 4"></path></svg>`;
      default:
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    }
  }

  function render(state) {
    const rawHistory = state.history || [];
    const activeFilter = state.historyFilter || "all";

    // Compute Category Counts
    const criticalCount = rawHistory.filter(e => e.categoryType === "critical" || e.tier === "CRITICAL").length;
    const cautionCount = rawHistory.filter(e => e.categoryType === "caution" || e.tier === "CAUTION").length;
    const noticeCount = rawHistory.filter(e => e.categoryType === "notice" || e.tier === "AWARE" || e.tier === "NOTICE").length;
    const infoCount = rawHistory.filter(e => e.categoryType === "info" || e.tier === "INFO").length;
    const totalCount = rawHistory.length;

    // Filter events
    const filteredHistory = rawHistory.filter(item => {
      if (activeFilter === "all") return true;
      if (activeFilter === "critical") return item.categoryType === "critical" || item.tier === "CRITICAL";
      if (activeFilter === "caution") return item.categoryType === "caution" || item.tier === "CAUTION";
      if (activeFilter === "notice") return item.categoryType === "notice" || item.tier === "AWARE" || item.tier === "NOTICE";
      if (activeFilter === "info") return item.categoryType === "info" || item.tier === "INFO";
      return true;
    });

    // Group by Date Label
    const dateGroups = {};
    filteredHistory.forEach(item => {
      const group = item.dateLabel || "TODAY — RECENT";
      if (!dateGroups[group]) dateGroups[group] = [];
      dateGroups[group].push(item);
    });

    // Segmented bar percentage calculation
    const critPct = totalCount > 0 ? (criticalCount / totalCount) * 100 : 0;
    const cautPct = totalCount > 0 ? (cautionCount / totalCount) * 100 : 0;
    const notiPct = totalCount > 0 ? (noticeCount / totalCount) * 100 : 0;
    const infoPct = totalCount > 0 ? (infoCount / totalCount) * 100 : 0;

    container.innerHTML = `
      <div class="history-view-container">
        <!-- Title & Subtitle -->
        <div class="history-header-block">
          <div class="history-title-row">
            <h1 class="history-main-title">Sound History</h1>
            <div class="history-private-badge">
              <span>🛡</span>
              <span>Private &amp; Local</span>
            </div>
          </div>
          <p class="history-subtitle">Log of detected environmental sounds and audio patterns</p>
        </div>

        <!-- 1. Today's Acoustic Summary Card -->
        <div class="acoustic-summary-card">
          <div class="summary-card-header">
            <div class="summary-title-group">
              <span style="color: var(--brand-teal);">📈</span>
              <span>Today's Acoustic Summary</span>
            </div>
            <span class="summary-total-logged">${totalCount} Events Logged</span>
          </div>

          <!-- Segmented Progress Bar -->
          <div class="acoustic-bar-track">
            <div class="bar-segment critical" style="width: ${critPct}%;"></div>
            <div class="bar-segment caution" style="width: ${cautPct}%;"></div>
            <div class="bar-segment notice" style="width: ${notiPct}%;"></div>
            <div class="bar-segment info" style="width: ${infoPct}%;"></div>
          </div>

          <!-- Legend Row -->
          <div class="acoustic-legend-row">
            <div class="legend-item">
              <span class="legend-dot critical"></span>
              <span>${criticalCount} Critical</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot caution"></span>
              <span>${cautionCount} Cautions</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot notice"></span>
              <span>${noticeCount} Notice</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot info"></span>
              <span>${infoCount} Info</span>
            </div>
          </div>
        </div>

        <!-- 2. On-Device Classification Callout Banner -->
        <div class="history-ondevice-banner">
          <span style="font-size: 15px;">🔒</span>
          <div>
            <strong>On-device classification:</strong> Audio is analyzed locally and never leaves your phone.
          </div>
        </div>

        <!-- 3. Filter Pills Row -->
        <div class="history-filter-row">
          <button class="history-filter-pill ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">
            <span>All</span>
            <span class="pill-count">${totalCount}</span>
          </button>
          <button class="history-filter-pill ${activeFilter === 'critical' ? 'active' : ''}" data-filter="critical">
            <span class="legend-dot critical"></span>
            <span>Critical</span>
            <span class="pill-count">${criticalCount}</span>
          </button>
          <button class="history-filter-pill ${activeFilter === 'caution' ? 'active' : ''}" data-filter="caution">
            <span class="legend-dot caution"></span>
            <span>Caution</span>
            <span class="pill-count">${cautionCount}</span>
          </button>
          <button class="history-filter-pill ${activeFilter === 'notice' ? 'active' : ''}" data-filter="notice">
            <span class="legend-dot notice"></span>
            <span>Notice</span>
            <span class="pill-count">${noticeCount}</span>
          </button>
          <button class="history-filter-pill ${activeFilter === 'info' ? 'active' : ''}" data-filter="info">
            <span class="legend-dot info"></span>
            <span>Info</span>
            <span class="pill-count">${infoCount}</span>
          </button>
        </div>

        <!-- 4. Grouped Timeline Section -->
        <div class="history-timeline-section">
          ${Object.keys(dateGroups).length === 0 ? `
            <div class="history-empty-state">
              <span>🔇</span>
              <p>No sound events recorded in this category yet.</p>
            </div>
          ` : Object.keys(dateGroups).map(dateKey => `
            <div class="timeline-date-header">
              <div class="date-indicator">
                <span class="dot"></span>
                <span>${dateKey}</span>
              </div>
              <span>${dateGroups[dateKey].length} events</span>
            </div>

            ${dateGroups[dateKey].map(item => `
              <div class="history-event-card">
                <div class="history-card-top-row">
                  <div class="history-event-icon-square ${item.categoryType || item.tier.toLowerCase()}">
                    ${getIconSvg(item.icon)}
                  </div>
                  <div class="history-event-info">
                    <div class="history-title-tier-row">
                      <span class="history-event-title">${item.display_name}</span>
                      <span class="sound-tier-pill ${item.tier}">${item.tier}</span>
                    </div>
                    <span class="history-event-submeta">${item.timestampStr}</span>
                  </div>
                </div>

                <!-- Expanded Metadata Grid (Direction, dB, Confidence) -->
                ${(item.directionStr || item.dbStr || item.confStr) ? `
                  <div class="history-event-metabox">
                    <div class="metabox-item">
                      <span class="metabox-label">Direction</span>
                      <span class="metabox-value">📍 ${item.directionStr || '0° N'}</span>
                    </div>
                    <div class="metabox-item">
                      <span class="metabox-label">Peak Level</span>
                      <span class="metabox-value ${item.tier === 'CRITICAL' ? 'danger' : ''}">${item.dbStr || '65 dB'}</span>
                    </div>
                    <div class="metabox-item">
                      <span class="metabox-label">Confidence</span>
                      <span class="metabox-value">${item.confStr || '90%'}</span>
                    </div>
                  </div>
                ` : ''}

                <!-- Card Footer (Evacuation Guide pill & Review/Details action) -->
                <div class="history-card-footer">
                  ${item.hasGuide ? `
                    <span class="history-guide-pill" data-action="guide">
                      <span>🏃</span>
                      <span>Evacuation guide viewed</span>
                    </span>
                  ` : ''}
                  <a class="history-card-action-link" data-id="${item.id}">
                    ${item.tier === 'CRITICAL' ? 'Details &gt;' : 'Review &gt;'}
                  </a>
                </div>
              </div>
            `).join('')}
          `).join('')}
        </div>
      </div>
    `;

    // Bind Filter Pills Click Handlers
    container.querySelectorAll(".history-filter-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const filter = btn.getAttribute("data-filter");
        appState.set({ historyFilter: filter });
      });
    });

    // Bind Evacuation Guide Pill Click Handlers
    container.querySelectorAll(".history-guide-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        appState.openActionGuide();
      });
    });

    // Bind Details Link Handlers
    container.querySelectorAll(".history-card-action-link").forEach(link => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("data-id");
        const found = rawHistory.find(h => h.id === id);
        if (found && (found.tier === "CRITICAL" || found.hasGuide)) {
          appState.openActionGuide();
        } else if (found) {
          alert(`Sound Event Details:\nCategory: ${found.display_name}\nLevel: ${found.dbStr}\nDirection: ${found.directionStr}\nConfidence: ${found.confStr}`);
        }
      });
    });
  }

  appState.subscribe(state => {
    if (state.currentTab === "history") {
      render(state);
    }
  });

  render(appState.get());
}
