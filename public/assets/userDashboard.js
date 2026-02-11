// public/assets/userDashboard.js
(function () {
  const TOKEN_KEY = "ma_user_token";
  let token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href = "./userLogin.html";
    return;
  }

  // ---------- Helpers ----------
  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  function showToast(msg, ok = true) {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");
    toastMsg.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openModal(overlay) {
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
    if (window.lucide) lucide.createIcons();
  }

  function closeModal(overlay) {
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  }

  async function apiJSON(url, opts = {}) {
    const r = await fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), ...authHeaders() }
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || "request_failed");
    return data;
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  // ---------- Elements ----------
  const userNameEl = document.getElementById("userName");

  const navItems = Array.from(document.querySelectorAll(".navItem[data-view]"));
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  const viewDashboard = document.getElementById("viewDashboard");
  const viewTickets = document.getElementById("viewTickets");
  const viewNotifications = document.getElementById("viewNotifications");

  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");

  // KPIs
  const kpiOpen = document.getElementById("kpiOpen");
  const kpiProg = document.getElementById("kpiProg");
  const kpiResolved = document.getElementById("kpiResolved");
  const kpiClosed = document.getElementById("kpiClosed");

  // Charts
  let chartDaily, chartStatus, chartPriority;

  // Tickets UI
  const qEl = document.getElementById("q");
  const statusFilterEl = document.getElementById("statusFilter");
  const priorityFilterEl = document.getElementById("priorityFilter");
  const applyBtn = document.getElementById("applyBtn");
  const newTicketBtn = document.getElementById("newTicketBtn");
  const ticketsBody = document.getElementById("ticketsBody");
  const emptyState = document.getElementById("emptyState");

  // Ticket modal
  const modalTicketOverlay = document.getElementById("modalTicketOverlay");
  const closeTicketModal = document.getElementById("closeTicketModal");
  const cancelTicketBtn = document.getElementById("cancelTicketBtn");
  const saveTicketBtn = document.getElementById("saveTicketBtn");
  const tTitle = document.getElementById("tTitle");
  const tDesc = document.getElementById("tDesc");
  const tPriority = document.getElementById("tPriority");

  // Notifications UI
  const notifBtn = document.getElementById("notifBtn");
  const notifBadge = document.getElementById("notifBadge");

  const notifDrawerOverlay = document.getElementById("notifDrawerOverlay");
  const closeDrawerBtn = document.getElementById("closeDrawerBtn");
  const drawerList = document.getElementById("drawerList");
  const drawerViewAllBtn = document.getElementById("drawerViewAllBtn");

  const nqEl = document.getElementById("nq");
  const nFilterEl = document.getElementById("nFilter");
  const applyNotifBtn = document.getElementById("applyNotifBtn");
  const markAllReadBtn = document.getElementById("markAllReadBtn");
  const notifList = document.getElementById("notifList");

  // Reply modal
  const modalReplyOverlay = document.getElementById("modalReplyOverlay");
  const closeReplyModal = document.getElementById("closeReplyModal");
  const cancelReplyBtn = document.getElementById("cancelReplyBtn");
  const sendReplyBtn = document.getElementById("sendReplyBtn");
  const replyText = document.getElementById("replyText");
  const replySubtitle = document.getElementById("replySubtitle");

  // Reset password modal (obrigatório)
  const modalResetOverlay = document.getElementById("modalResetOverlay");
  const newPass = document.getElementById("newPass");
  const newPass2 = document.getElementById("newPass2");
  const saveNewPassBtn = document.getElementById("saveNewPassBtn");

  // Shortcuts (dashboard)
  const goTickets = document.getElementById("goTickets");
  const goNotifications = document.getElementById("goNotifications");
  const goNewTicket = document.getElementById("goNewTicket");

  // ---------- State ----------
  let me = null;
  let currentTickets = [];
  let currentNotifications = [];
  let replyingNotificationId = null;

  // ---------- View switch ----------
  function setView(view) {
    navItems.forEach((it) => it.classList.toggle("active", it.dataset.view === view));

    viewDashboard.style.display = view === "dashboard" ? "" : "none";
    viewTickets.style.display = view === "tickets" ? "" : "none";
    viewNotifications.style.display = view === "notifications" ? "" : "none";

    if (view === "dashboard") {
      pageTitle.textContent = "Dashboard";
      pageSubtitle.textContent = "Visão geral dos seus chamados e notificações.";
    } else if (view === "tickets") {
      pageTitle.textContent = "Chamados";
      pageSubtitle.textContent = "Crie e acompanhe seus chamados.";
    } else {
      pageTitle.textContent = "Notificações";
      pageSubtitle.textContent = "Veja detalhes e responda notificações dentro do sistema.";
    }

    localStorage.setItem("ma_user_view", view);
    if (window.lucide) lucide.createIcons();
  }

  navItems.forEach((el) => el.addEventListener("click", () => setView(el.dataset.view)));

  goTickets?.addEventListener("click", () => setView("tickets"));
  goNotifications?.addEventListener("click", () => setView("notifications"));
  goNewTicket?.addEventListener("click", () => {
    setView("tickets");
    openModal(modalTicketOverlay);
  });

  // ---------- Password reset flow (obrigatório) ----------
  function forceResetPassword() {
    // trava tudo e abre modal
    openModal(modalResetOverlay);

    // bloqueia fechar clicando fora
    modalResetOverlay.addEventListener("click", (e) => {
      if (e.target === modalResetOverlay) {
        showToast("Você precisa redefinir a senha para continuar.", false);
      }
    });
  }

  saveNewPassBtn.addEventListener("click", async () => {
    const p1 = String(newPass.value || "").trim();
    const p2 = String(newPass2.value || "").trim();

    if (p1.length < 6) return showToast("Senha deve ter no mínimo 6 caracteres", false);
    if (p1 !== p2) return showToast("As senhas não coincidem", false);
    if (p1 === "123456") return showToast("A nova senha não pode ser 123456", false);

    saveNewPassBtn.disabled = true;

    try {
      const data = await apiJSON("/api/user/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: p1 })
      });

      // ✅ troca token e libera sistema
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);

      closeModal(modalResetOverlay);
      showToast("Senha redefinida com sucesso");

      // recarrega dados
      await bootLoad();
    } catch (e) {
      const msg = e.message === "weak_password" ? "Senha fraca" : "Falha ao redefinir senha";
      showToast(msg, false);
    } finally {
      saveNewPassBtn.disabled = false;
    }
  });

  // ---------- API loaders ----------
  async function loadMe() {
    const data = await apiJSON("/api/user/me");
    me = data.user;
    userNameEl.textContent = `Acesso: ${me.name}`;
  }

  async function loadTickets() {
    const params = new URLSearchParams();
    const q = (qEl.value || "").trim();
    const st = (statusFilterEl.value || "").trim();
    const pr = (priorityFilterEl.value || "").trim();
    if (q) params.set("q", q);
    if (st) params.set("status", st);
    if (pr) params.set("priority", pr);

    const data = await apiJSON(`/api/user/tickets?${params.toString()}`);
    currentTickets = data.tickets || [];
    renderTickets();
    renderDashboardCharts();
  }

  async function loadNotifications() {
    const params = new URLSearchParams();
    const q = (nqEl.value || "").trim();
    const f = (nFilterEl.value || "").trim();
    if (q) params.set("q", q);
    if (f) params.set("filter", f);

    const data = await apiJSON(`/api/user/notifications?${params.toString()}`);
    currentNotifications = data.notifications || [];
    renderBadge();
    renderDrawer();
    renderNotificationsPage();
  }

  // ---------- Render: Tickets ----------
  function mapStatus(s) {
    if (s === "open") return "Aberto";
    if (s === "in_progress") return "Em andamento";
    if (s === "resolved") return "Resolvido";
    if (s === "closed") return "Fechado";
    return s || "-";
  }
  function mapPriority(p) {
    if (p === "low") return "Baixa";
    if (p === "normal") return "Normal";
    if (p === "high") return "Alta";
    if (p === "urgent") return "Urgente";
    return p || "-";
  }

  function renderTickets() {
    ticketsBody.innerHTML = "";

    if (!currentTickets.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    for (const t of currentTickets) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${t.ticket_no ?? "-"}</strong></td>
        <td>
          <div style="font-weight:1000;">${escapeHtml(t.title)}</div>
          <div class="muted" style="font-weight:750;font-size:12px;margin-top:3px;">
            ${escapeHtml((t.description || "").slice(0, 90))}${(t.description || "").length > 90 ? "..." : ""}
          </div>
        </td>
        <td class="muted" style="font-weight:900;">${escapeHtml(mapStatus(t.status))}</td>
        <td class="muted" style="font-weight:900;">${escapeHtml(mapPriority(t.priority))}</td>
        <td style="text-align:right;">
          <span class="pill neutral">${escapeHtml(fmtDate(t.created_at))}</span>
        </td>
      `;
      ticketsBody.appendChild(tr);
    }
    if (window.lucide) lucide.createIcons();
  }

  // Create ticket modal
  function bindTicketModal() {
    modalTicketOverlay.addEventListener("click", (e) => {
      if (e.target === modalTicketOverlay) closeModal(modalTicketOverlay);
    });
    closeTicketModal.addEventListener("click", () => closeModal(modalTicketOverlay));
    cancelTicketBtn.addEventListener("click", () => closeModal(modalTicketOverlay));

    newTicketBtn.addEventListener("click", () => openModal(modalTicketOverlay));

    saveTicketBtn.addEventListener("click", async () => {
      const payload = {
        title: (tTitle.value || "").trim(),
        description: (tDesc.value || "").trim(),
        priority: tPriority.value
      };
      if (!payload.title || !payload.description) return showToast("Preencha título e descrição", false);

      // fecha na hora
      closeModal(modalTicketOverlay);

      try {
        await apiJSON("/api/user/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        tTitle.value = "";
        tDesc.value = "";
        tPriority.value = "normal";
        showToast("Chamado criado");
        await loadTickets();
      } catch (e) {
        if (e.message === "must_reset_password") {
          showToast("Você precisa redefinir a senha para continuar", false);
          forceResetPassword();
          return;
        }
        showToast("Erro ao criar chamado", false);
      }
    });
  }

  // Filters
  applyBtn.addEventListener("click", () => loadTickets());
  qEl.addEventListener("keydown", (e) => { if (e.key === "Enter") loadTickets(); });

  // ---------- Render: Notifications ----------
  function unreadCount() {
    return currentNotifications.filter((n) => !n.read).length;
  }

  function renderBadge() {
    const c = unreadCount();
    if (c > 0) {
      notifBadge.style.display = "block";
      notifBadge.textContent = c;
    } else {
      notifBadge.style.display = "none";
    }
  }

  function notifCard(n, compact = false) {
    const readPill = n.read
      ? `<span class="pill ok"><i data-lucide="check" class="icon" style="width:16px;height:16px;"></i> Lida</span>`
      : `<span class="pill warn"><i data-lucide="dot" class="icon" style="width:16px;height:16px;"></i> Não lida</span>`;

    const repliesCount = (n.replies || []).length;

    return `
      <div class="card" style="margin:0 0 10px; padding:14px; border-radius:16px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div style="min-width:0;">
            <div style="font-weight:1100;">${escapeHtml(n.title)}</div>
            <div class="muted" style="font-weight:800; font-size:12px; margin-top:4px;">
              ${escapeHtml(fmtDate(n.created_at))} • ${escapeHtml(n.kind)}
              ${repliesCount ? ` • ${repliesCount} resposta(s)` : ""}
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            ${readPill}
          </div>
        </div>

        <div class="muted" style="margin-top:8px; font-weight:850;">
          ${escapeHtml(compact ? (n.description || "").slice(0, 120) : (n.description || ""))}
          ${compact && (n.description || "").length > 120 ? "..." : ""}
        </div>

        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost" data-n-mark="${n.id}">
            <i data-lucide="check-check" class="icon"></i>
            Marcar como lida
          </button>
          <button class="btn btn-primary" data-n-reply="${n.id}">
            <i data-lucide="reply" class="icon" style="color:white;"></i>
            Responder
          </button>
        </div>

        ${(!compact && repliesCount) ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(110,21,51,.10);">
            <div class="muted" style="font-weight:1000; margin-bottom:8px;">Histórico</div>
            ${(n.replies || []).map(r => `
              <div style="padding:10px 12px; border-radius:14px; background:rgba(246,211,221,.45); border:1px solid rgba(110,21,51,.10); margin-bottom:8px;">
                <div class="muted" style="font-weight:900; font-size:12px;">
                  ${escapeHtml(r.from_role)} • ${escapeHtml(fmtDate(r.created_at))}
                </div>
                <div style="font-weight:900; margin-top:6px;">${escapeHtml(r.message)}</div>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderDrawer() {
    drawerList.innerHTML = "";

    const list = currentNotifications.slice(0, 6);

    if (!list.length) {
      drawerList.innerHTML = `<div class="muted" style="padding:12px; font-weight:900;">Sem notificações</div>`;
      return;
    }

    drawerList.innerHTML = list.map((n) => notifCard(n, true)).join("");
    if (window.lucide) lucide.createIcons();
  }

  function renderNotificationsPage() {
    notifList.innerHTML = "";

    if (!currentNotifications.length) {
      notifList.innerHTML = `<div class="muted" style="padding:14px; font-weight:900;">Nenhuma notificação</div>`;
      return;
    }

    notifList.innerHTML = currentNotifications.map((n) => notifCard(n, false)).join("");
    if (window.lucide) lucide.createIcons();
  }

  // Drawer open/close
  notifBtn.addEventListener("click", () => {
    notifDrawerOverlay.style.display = "block";
  });
  closeDrawerBtn.addEventListener("click", () => {
    notifDrawerOverlay.style.display = "none";
  });
  notifDrawerOverlay.addEventListener("click", (e) => {
    if (e.target === notifDrawerOverlay) notifDrawerOverlay.style.display = "none";
  });

  drawerViewAllBtn.addEventListener("click", () => {
    notifDrawerOverlay.style.display = "none";
    setView("notifications");
  });

  // Notifications actions
  async function markRead(id) {
    try {
      await apiJSON(`/api/user/notifications/${id}/read`, { method: "PATCH" });
      await loadNotifications();
    } catch (e) {
      if (e.message === "must_reset_password") {
        showToast("Você precisa redefinir a senha para continuar", false);
        forceResetPassword();
        return;
      }
      showToast("Falha ao marcar como lida", false);
    }
  }

  notifList.addEventListener("click", async (e) => {
    const markBtn = e.target.closest("[data-n-mark]");
    const replyBtn = e.target.closest("[data-n-reply]");
    if (markBtn) return markRead(markBtn.dataset.nMark);
    if (replyBtn) return openReply(replyBtn.dataset.nReply);
  });

  drawerList.addEventListener("click", async (e) => {
    const markBtn = e.target.closest("[data-n-mark]");
    const replyBtn = e.target.closest("[data-n-reply]");
    if (markBtn) return markRead(markBtn.dataset.nMark);
    if (replyBtn) return openReply(replyBtn.dataset.nReply);
  });

  // Reply modal
  function bindReplyModal() {
    modalReplyOverlay.addEventListener("click", (e) => {
      if (e.target === modalReplyOverlay) closeModal(modalReplyOverlay);
    });
    closeReplyModal.addEventListener("click", () => closeModal(modalReplyOverlay));
    cancelReplyBtn.addEventListener("click", () => closeModal(modalReplyOverlay));

    sendReplyBtn.addEventListener("click", async () => {
      const msg = (replyText.value || "").trim();
      if (!msg) return showToast("Digite uma resposta", false);

      closeModal(modalReplyOverlay);

      try {
        await apiJSON(`/api/user/notifications/${replyingNotificationId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg })
        });

        showToast("Resposta enviada");
        await loadNotifications();
      } catch (e) {
        if (e.message === "must_reset_password") {
          showToast("Você precisa redefinir a senha para continuar", false);
          forceResetPassword();
          return;
        }
        showToast("Falha ao responder", false);
      }
    });
  }

  function openReply(id) {
    replyingNotificationId = id;
    replySubtitle.textContent = "Resposta registrada no sistema";
    replyText.value = "";
    openModal(modalReplyOverlay);
  }

  // Notifications filters
  applyNotifBtn.addEventListener("click", () => loadNotifications());
  nqEl.addEventListener("keydown", (e) => { if (e.key === "Enter") loadNotifications(); });

  markAllReadBtn.addEventListener("click", async () => {
    try {
      await apiJSON("/api/user/notifications/mark-all-read", { method: "POST" });
      showToast("Tudo marcado como lido");
      await loadNotifications();
    } catch (e) {
      if (e.message === "must_reset_password") {
        showToast("Você precisa redefinir a senha para continuar", false);
        forceResetPassword();
        return;
      }
      showToast("Falha ao marcar tudo", false);
    }
  });

  // ---------- Dashboard charts ----------
  function fillMissingDays(points, days = 14) {
    const map = new Map(points.map((p) => [p.date, p.created]));
    const out = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;
      out.push({ date: key, created: map.get(key) || 0 });
    }
    return out;
  }

  function renderDashboardCharts() {
    const countsByStatus = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    const countsByPriority = { low: 0, normal: 0, high: 0, urgent: 0 };

    const dailyMap = new Map();

    for (const t of currentTickets) {
      if (countsByStatus[t.status] != null) countsByStatus[t.status]++;
      if (countsByPriority[t.priority] != null) countsByPriority[t.priority]++;

      const d = new Date(t.created_at);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
      }
    }

    kpiOpen.textContent = countsByStatus.open;
    kpiProg.textContent = countsByStatus.in_progress;
    kpiResolved.textContent = countsByStatus.resolved;
    kpiClosed.textContent = countsByStatus.closed;

    const daily = fillMissingDays(
      Array.from(dailyMap.entries()).map(([date, created]) => ({ date, created })),
      14
    );

    const dailyLabels = daily.map((d) => d.date.slice(5));
    const dailyVals = daily.map((d) => d.created);

    const statusLabels = ["Abertos", "Em andamento", "Resolvidos", "Fechados"];
    const statusVals = [
      countsByStatus.open,
      countsByStatus.in_progress,
      countsByStatus.resolved,
      countsByStatus.closed
    ];

    const prLabels = ["Baixa", "Normal", "Alta", "Urgente"];
    const prVals = [
      countsByPriority.low,
      countsByPriority.normal,
      countsByPriority.high,
      countsByPriority.urgent
    ];

    if (chartDaily) chartDaily.destroy();
    if (chartStatus) chartStatus.destroy();
    if (chartPriority) chartPriority.destroy();

    const ctxDaily = document.getElementById("chartDaily");
    const ctxStatus = document.getElementById("chartStatus");
    const ctxPriority = document.getElementById("chartPriority");

    chartDaily = new Chart(ctxDaily, {
      type: "line",
      data: {
        labels: dailyLabels,
        datasets: [{
          label: "Criados",
          data: dailyVals,
          borderColor: "rgba(110,21,51,.85)",
          backgroundColor: "rgba(110,21,51,.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    chartStatus = new Chart(ctxStatus, {
      type: "doughnut",
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusVals,
          backgroundColor: [
            "rgba(180,35,24,.18)",
            "rgba(179,92,0,.18)",
            "rgba(11,138,90,.18)",
            "rgba(106,111,123,.18)"
          ],
          borderColor: [
            "rgba(180,35,24,.55)",
            "rgba(179,92,0,.55)",
            "rgba(11,138,90,.55)",
            "rgba(106,111,123,.55)"
          ],
          borderWidth: 1
        }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });

    chartPriority = new Chart(ctxPriority, {
      type: "bar",
      data: {
        labels: prLabels,
        datasets: [{
          data: prVals,
          backgroundColor: "rgba(246,211,221,.75)",
          borderColor: "rgba(110,21,51,.35)",
          borderWidth: 1,
          borderRadius: 10
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  // ---------- Boot / reload ----------
  async function bootLoad() {
    await loadMe();

    // ✅ se precisa resetar, força modal e NÃO carrega tickets/notifs
    if (me.must_reset_password) {
      forceResetPassword();
      return;
    }

    await Promise.all([loadTickets(), loadNotifications()]);
  }

  refreshBtn.addEventListener("click", () => bootLoad());

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "./userLogin.html";
  });

  function bindBaseModals() {
    bindTicketModal();
    bindReplyModal();
  }

  // ---------- Init ----------
  (async function init() {
    const savedView = localStorage.getItem("ma_user_view") || "dashboard";
    setView(savedView);

    bindBaseModals();
    await bootLoad();

    if (window.lucide) lucide.createIcons();
  })();
})();
