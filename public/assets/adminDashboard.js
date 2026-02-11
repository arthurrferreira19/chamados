// public/assets/adminDashboard.js (SUBSTITUA O ARQUIVO INTEIRO)
(function () {
  const TOKEN_KEY = "ma_admin_token";
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href = "./adminLogin.html";
    return;
  }

  // ---- Keyframes (spinner) ----
  (() => {
    if (!document.getElementById("spinKeyframes")) {
      const style = document.createElement("style");
      style.id = "spinKeyframes";
      style.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
      document.head.appendChild(style);
    }
  })();

  // ---- Elements ----
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const navItems = Array.from(document.querySelectorAll(".navItem[data-view]"));

  const viewDashboard = document.getElementById("viewDashboard");
  const viewTickets = document.getElementById("viewTickets");
  const viewUsers = document.getElementById("viewUsers");

  const adminNameEl = document.getElementById("adminName");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const smtpPill = document.getElementById("smtpPill");

  const kpiOpen = document.getElementById("kpiOpen");
  const kpiProg = document.getElementById("kpiProg");
  const kpiResolved = document.getElementById("kpiResolved");
  const kpiClosed = document.getElementById("kpiClosed");
  const usersKpiPill = document.getElementById("usersKpiPill");

  const goOpen = document.getElementById("goOpen");
  const goUrgent = document.getElementById("goUrgent");
  const goProgress = document.getElementById("goProgress");
  const goAll = document.getElementById("goAll");
  const goUsers = document.getElementById("goUsers");

  // Tickets
  const qEl = document.getElementById("q");
  const statusFilterEl = document.getElementById("statusFilter");
  const priorityFilterEl = document.getElementById("priorityFilter");
  const applyTicketBtn = document.getElementById("applyTicketBtn");
  const newTicketBtn = document.getElementById("newTicketBtn");
  const ticketsBody = document.getElementById("ticketsBody");
  const emptyTickets = document.getElementById("emptyTickets");
  const quickChips = Array.from(document.querySelectorAll(".chip[data-quick]"));

  // Users
  const uqEl = document.getElementById("uq");
  const applyUserBtn = document.getElementById("applyUserBtn");
  const newUserBtn = document.getElementById("newUserBtn");
  const usersBody = document.getElementById("usersBody");
  const emptyUsers = document.getElementById("emptyUsers");

  // Toast
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");

  // Ticket modal
  const modalTicketOverlay = document.getElementById("modalTicketOverlay");
  const closeTicketModal = document.getElementById("closeTicketModal");
  const cancelTicketModal = document.getElementById("cancelTicketModal");
  const saveTicketBtn = document.getElementById("saveTicketBtn");
  const ticketModalTitle = document.getElementById("ticketModalTitle");
  const ticketModalSubtitle = document.getElementById("ticketModalSubtitle");
  const tTitle = document.getElementById("tTitle");
  const tDesc = document.getElementById("tDesc");
  const tStatus = document.getElementById("tStatus");
  const tPriority = document.getElementById("tPriority");
  const tRequesterName = document.getElementById("tRequesterName");
  const tRequesterEmail = document.getElementById("tRequesterEmail");
  const tAssigned = document.getElementById("tAssigned");

  // Ticket notify modal
  const modalTicketNotifyOverlay = document.getElementById("modalTicketNotifyOverlay");
  const closeTicketNotifyModal = document.getElementById("closeTicketNotifyModal");
  const cancelTicketNotifyBtn = document.getElementById("cancelTicketNotifyBtn");
  const sendTicketNotifyBtn = document.getElementById("sendTicketNotifyBtn");
  const ticketNotifySubtitle = document.getElementById("ticketNotifySubtitle");
  const ticketNotifyTitle = document.getElementById("ticketNotifyTitle");
  const ticketNotifyDesc = document.getElementById("ticketNotifyDesc");

  // User modal
  const modalUserOverlay = document.getElementById("modalUserOverlay");
  const closeUserModal = document.getElementById("closeUserModal");
  const cancelUserModal = document.getElementById("cancelUserModal");
  const saveUserBtn = document.getElementById("saveUserBtn");
  const userModalTitle = document.getElementById("userModalTitle");
  const userModalSubtitle = document.getElementById("userModalSubtitle");
  const uName = document.getElementById("uName");
  const uEmail = document.getElementById("uEmail");
  const uPassword = document.getElementById("uPassword");

  // User notify modal
  const modalUserNotifyOverlay = document.getElementById("modalUserNotifyOverlay");
  const closeUserNotifyModal = document.getElementById("closeUserNotifyModal");
  const cancelUserNotifyBtn = document.getElementById("cancelUserNotifyBtn");
  const sendUserNotifyBtn = document.getElementById("sendUserNotifyBtn");
  const userNotifySubtitle = document.getElementById("userNotifySubtitle");
  const userNotifyTitle = document.getElementById("userNotifyTitle");
  const userNotifyDesc = document.getElementById("userNotifyDesc");

  // Charts
  let chartDaily, chartStatus, chartPriority;

  // State
  let currentTickets = [];
  let currentUsers = [];

  let isTicketCreate = false;
  let editingTicketId = null;
  let notifyingTicketId = null;

  let isUserCreate = false;
  let editingUserId = null;
  let notifyingUserId = null;

  // ---- Utils ----
  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  function showToast(msg, ok = true) {
    toastMsg.textContent = msg;
    toast.querySelector("i").setAttribute("data-lucide", ok ? "check-circle-2" : "alert-triangle");
    toast.classList.add("show");
    if (window.lucide) lucide.createIcons();
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

  function mapStatus(status) {
    switch (status) {
      case "open": return { label: "Aberto", cls: "bad" };
      case "in_progress": return { label: "Em andamento", cls: "warn" };
      case "resolved": return { label: "Resolvido", cls: "ok" };
      case "closed": return { label: "Fechado", cls: "neutral" };
      default: return { label: status || "-", cls: "neutral" };
    }
  }

  function mapPriority(p) {
    switch (p) {
      case "low": return { label: "Baixa", cls: "neutral" };
      case "normal": return { label: "Normal", cls: "neutral" };
      case "high": return { label: "Alta", cls: "warn" };
      case "urgent": return { label: "Urgente", cls: "bad" };
      default: return { label: p || "Normal", cls: "neutral" };
    }
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // ---- View ----
  function setView(view) {
    navItems.forEach((it) => it.classList.toggle("active", it.dataset.view === view));

    viewDashboard.style.display = view === "dashboard" ? "" : "none";
    viewTickets.style.display = view === "tickets" ? "" : "none";
    viewUsers.style.display = view === "users" ? "" : "none";

    if (view === "dashboard") {
      pageTitle.textContent = "Dashboard";
      pageSubtitle.textContent = "Visão geral dos chamados e tendências.";
    } else if (view === "tickets") {
      pageTitle.textContent = "Chamados";
      pageSubtitle.textContent = "Gerencie, edite, exclua e notifique usuários com rapidez.";
    } else {
      pageTitle.textContent = "Usuários";
      pageSubtitle.textContent = "Crie, edite, exclua e notifique usuários.";
    }

    localStorage.setItem("ma_admin_view", view);
    if (window.lucide) lucide.createIcons();
  }

  navItems.forEach((el) => el.addEventListener("click", () => setView(el.dataset.view)));

  goOpen.addEventListener("click", () => {
    setView("tickets");
    statusFilterEl.value = "open";
    priorityFilterEl.value = "";
    reloadTickets();
  });

  goUrgent.addEventListener("click", () => {
    setView("tickets");
    statusFilterEl.value = "";
    priorityFilterEl.value = "urgent";
    reloadTickets();
  });

  goProgress.addEventListener("click", () => {
    setView("tickets");
    statusFilterEl.value = "in_progress";
    priorityFilterEl.value = "";
    reloadTickets();
  });

  goAll.addEventListener("click", () => {
    setView("tickets");
    statusFilterEl.value = "";
    priorityFilterEl.value = "";
    reloadTickets();
  });

  goUsers.addEventListener("click", () => {
    setView("users");
    reloadUsers();
  });

  // ---- Modal close handlers ----
  [modalTicketOverlay, modalTicketNotifyOverlay, modalUserOverlay, modalUserNotifyOverlay].forEach((overlay) => {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(overlay); });
  });

  closeTicketModal.addEventListener("click", () => closeModal(modalTicketOverlay));
  cancelTicketModal.addEventListener("click", () => closeModal(modalTicketOverlay));
  closeTicketNotifyModal.addEventListener("click", () => closeModal(modalTicketNotifyOverlay));
  cancelTicketNotifyBtn.addEventListener("click", () => closeModal(modalTicketNotifyOverlay));

  closeUserModal.addEventListener("click", () => closeModal(modalUserOverlay));
  cancelUserModal.addEventListener("click", () => closeModal(modalUserOverlay));
  closeUserNotifyModal.addEventListener("click", () => closeModal(modalUserNotifyOverlay));
  cancelUserNotifyBtn.addEventListener("click", () => closeModal(modalUserNotifyOverlay));

  // ---- API ----
  async function apiJSON(url, opts = {}) {
    const r = await fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), ...authHeaders() }
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || "request_failed");
    return data;
  }

  async function loadMe() {
    const r = await fetch("/api/admin/me", { headers: authHeaders() });
    if (!r.ok) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "./adminLogin.html";
      return;
    }
    const data = await r.json();
    adminNameEl.textContent = `Acesso: ${data.admin?.name || "Admin"}`;
  }

  async function fetchSummary() {
    return apiJSON("/api/dashboard/summary?days=14");
  }

  async function fetchTickets() {
    const q = (qEl.value || "").trim();
    const status = (statusFilterEl.value || "").trim();
    const priority = (priorityFilterEl.value || "").trim();

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);

    const data = await apiJSON(`/api/tickets?${params.toString()}`);
    return data.tickets || [];
  }

  async function createTicket(payload) {
    return (await apiJSON("/api/tickets/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).ticket;
  }

  async function patchTicket(id, payload) {
    return (await apiJSON(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).ticket;
  }

  async function deleteTicket(id) {
    await apiJSON(`/api/tickets/${id}`, { method: "DELETE" });
  }

  async function notifyTicket(id, payload) {
    return apiJSON(`/api/tickets/${id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async function fetchUsers() {
    const q = (uqEl.value || "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const data = await apiJSON(`/api/users?${params.toString()}`);
    return data.users || [];
  }

  async function createUser(payload) {
    return (await apiJSON("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).user;
  }

  async function patchUser(id, payload) {
    return (await apiJSON(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).user;
  }

  async function deleteUser(id) {
    await apiJSON(`/api/users/${id}`, { method: "DELETE" });
  }

  async function notifyUser(id, payload) {
    return apiJSON(`/api/users/${id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  // ---- Dashboard render ----
  function fillMissingDays(daily, days = 14) {
    const map = new Map(daily.map((d) => [d.date, d.created]));
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

  function renderDashboard(summary) {
    const s = summary.countsByStatus || {};
    kpiOpen.textContent = s.open || 0;
    kpiProg.textContent = s.in_progress || 0;
    kpiResolved.textContent = s.resolved || 0;
    kpiClosed.textContent = s.closed || 0;

    smtpPill.innerHTML = `<i data-lucide="mail" class="icon" style="width:16px;height:16px;"></i> SMTP: ${summary.smtpConfigured ? "OK" : "OFF"}`;
    smtpPill.className = `pill ${summary.smtpConfigured ? "ok" : "warn"}`;

    const ut = summary.users?.total ?? 0;
    const umr = summary.users?.must_reset_password ?? 0;
    usersKpiPill.innerHTML = `<i data-lucide="user-check" class="icon" style="width:16px;height:16px;"></i> Usuários: <strong>${ut}</strong> • redefinir senha: <strong>${umr}</strong>`;
    usersKpiPill.className = `pill ${umr > 0 ? "warn" : "neutral"}`;

    const daily = fillMissingDays(summary.dailyCreated || [], 14);
    const dailyLabels = daily.map((d) => d.date.slice(5));
    const dailyVals = daily.map((d) => d.created);

    const statusLabels = ["Abertos", "Em andamento", "Resolvidos", "Fechados"];
    const statusVals = [s.open || 0, s.in_progress || 0, s.resolved || 0, s.closed || 0];

    const p = summary.countsByPriority || {};
    const prLabels = ["Baixa", "Normal", "Alta", "Urgente"];
    const prVals = [p.low || 0, p.normal || 0, p.high || 0, p.urgent || 0];

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
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    chartStatus = new Chart(ctxStatus, {
      type: "doughnut",
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusVals,
          backgroundColor: ["rgba(180,35,24,.18)", "rgba(179,92,0,.18)", "rgba(11,138,90,.18)", "rgba(106,111,123,.18)"],
          borderColor: ["rgba(180,35,24,.55)", "rgba(179,92,0,.55)", "rgba(11,138,90,.55)", "rgba(106,111,123,.55)"],
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
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  // ---- Tickets render + optimistic ----
  function ticketMatchesCurrentFilters(t) {
    const q = (qEl.value || "").trim().toLowerCase();
    const st = (statusFilterEl.value || "").trim();
    const pr = (priorityFilterEl.value || "").trim();
    if (st && t.status !== st) return false;
    if (pr && t.priority !== pr) return false;
    if (q) {
      const hay = [t.title, t.description, t.requester_name, t.requester_email, t.assigned_to, String(t.ticket_no ?? "")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function upsertTicketOptimistic(ticket) {
    const idx = currentTickets.findIndex((x) => x.id === ticket.id);
    const matches = ticketMatchesCurrentFilters(ticket);

    if (!matches) {
      if (idx !== -1) currentTickets.splice(idx, 1);
      renderTickets(currentTickets);
      return;
    }

    if (idx === -1) currentTickets.unshift(ticket);
    else currentTickets[idx] = ticket;

    currentTickets.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    renderTickets(currentTickets);
  }

  function removeTicketOptimistic(id) {
    currentTickets = currentTickets.filter((x) => x.id !== id);
    renderTickets(currentTickets);
  }

  function renderTickets(tickets) {
    ticketsBody.innerHTML = "";
    emptyTickets.style.display = tickets.length ? "none" : "block";

    for (const t of tickets) {
      const st = mapStatus(t.status);
      const pr = mapPriority(t.priority);
      const requester = [t.requester_name, t.requester_email].filter(Boolean).join(" • ");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${t.ticket_no ?? "-"}</strong></td>
        <td>
          <div style="font-weight:1000;">${escapeHtml(t.title)}</div>
          <div class="muted" style="font-weight:650; font-size:12px; margin-top:3px;">
            ${escapeHtml((t.description || "").slice(0, 90))}${(t.description || "").length > 90 ? "..." : ""}
          </div>
        </td>
        <td class="muted" style="font-weight:800;">${escapeHtml(requester || "-")}</td>
        <td class="muted" style="font-weight:800;">${escapeHtml(t.assigned_to || "-")}</td>
        <td><span class="pill ${pr.cls}">${escapeHtml(pr.label)}</span></td>
        <td><span class="pill ${st.cls}">${escapeHtml(st.label)}</span></td>
        <td>
          <div class="rowActions">
            <button class="btn btn-ghost" data-ticket-action="notify" data-id="${t.id}" title="Notificar" style="padding:10px 12px;">
              <i data-lucide="bell-ring" class="icon"></i>
            </button>
            <button class="btn btn-ghost" data-ticket-action="edit" data-id="${t.id}" title="Editar" style="padding:10px 12px;">
              <i data-lucide="file-pen-line" class="icon"></i>
            </button>
            <button class="btn btn-ghost" data-ticket-action="delete" data-id="${t.id}" title="Excluir" style="padding:10px 12px;">
              <i data-lucide="trash-2" class="icon"></i>
            </button>
          </div>
        </td>
      `;
      ticketsBody.appendChild(tr);
    }

    if (window.lucide) lucide.createIcons();
  }

  // ---- Users render + optimistic ----
  function userMatchesCurrentFilters(u) {
    const q = (uqEl.value || "").trim().toLowerCase();
    if (!q) return true;
    const hay = [u.name, u.email].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }

  function upsertUserOptimistic(user) {
    const idx = currentUsers.findIndex((x) => x.id === user.id);
    const matches = userMatchesCurrentFilters(user);

    if (!matches) {
      if (idx !== -1) currentUsers.splice(idx, 1);
      renderUsers(currentUsers);
      return;
    }

    if (idx === -1) currentUsers.unshift(user);
    else currentUsers[idx] = user;

    currentUsers.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    renderUsers(currentUsers);
  }

  function removeUserOptimistic(id) {
    currentUsers = currentUsers.filter((x) => x.id !== id);
    renderUsers(currentUsers);
  }

  function renderUsers(users) {
    usersBody.innerHTML = "";
    emptyUsers.style.display = users.length ? "none" : "block";

    for (const u of users) {
      const security = u.must_reset_password
        ? `<span class="pill warn"><i data-lucide="shield-alert" class="icon" style="width:16px;height:16px;"></i> Precisa redefinir</span>`
        : `<span class="pill ok"><i data-lucide="shield-check" class="icon" style="width:16px;height:16px;"></i> OK</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:1000;">${escapeHtml(u.name)}</td>
        <td class="muted" style="font-weight:900;">${escapeHtml(u.email)}</td>
        <td>${security}</td>
        <td class="muted" style="font-weight:800;">${escapeHtml(fmtDate(u.created_at))}</td>
        <td>
          <div class="rowActions">
            <button class="btn btn-ghost" data-user-action="notify" data-id="${u.id}" title="Notificar" style="padding:10px 12px;">
              <i data-lucide="bell" class="icon"></i>
            </button>
            <button class="btn btn-ghost" data-user-action="edit" data-id="${u.id}" title="Editar" style="padding:10px 12px;">
              <i data-lucide="user-pen" class="icon"></i>
            </button>
            <button class="btn btn-ghost" data-user-action="delete" data-id="${u.id}" title="Excluir" style="padding:10px 12px;">
              <i data-lucide="trash-2" class="icon"></i>
            </button>
          </div>
        </td>
      `;
      usersBody.appendChild(tr);
    }

    if (window.lucide) lucide.createIcons();
  }

  // ---- Tickets interactions ----
  applyTicketBtn.addEventListener("click", () => reloadTickets());
  qEl.addEventListener("keydown", (e) => { if (e.key === "Enter") reloadTickets(); });

  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      quickChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");

      const v = chip.dataset.quick;
      if (v === "open") { statusFilterEl.value = "open"; priorityFilterEl.value = ""; }
      else if (v === "in_progress") { statusFilterEl.value = "in_progress"; priorityFilterEl.value = ""; }
      else if (v === "resolved") { statusFilterEl.value = "resolved"; priorityFilterEl.value = ""; }
      else if (v === "urgent") { statusFilterEl.value = ""; priorityFilterEl.value = "urgent"; }
      else { statusFilterEl.value = ""; priorityFilterEl.value = ""; }

      reloadTickets();
    });
  });

  newTicketBtn.addEventListener("click", () => {
    isTicketCreate = true;
    editingTicketId = null;

    ticketModalTitle.textContent = "Novo Chamado";
    ticketModalSubtitle.textContent = "Criar um novo ticket manualmente";

    tTitle.value = "";
    tDesc.value = "";
    tStatus.value = "open";
    tPriority.value = "normal";
    tRequesterName.value = "";
    tRequesterEmail.value = "";
    tAssigned.value = "";

    openModal(modalTicketOverlay);
  });

  ticketsBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-ticket-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.ticketAction;
    const ticket = currentTickets.find((t) => t.id === id);
    if (!ticket) return;

    if (action === "edit") {
      isTicketCreate = false;
      editingTicketId = id;

      ticketModalTitle.textContent = "Editar Chamado";
      ticketModalSubtitle.textContent = `Chamado #${ticket.ticket_no || "-"} • ${ticket.requester_email || "sem email"}`;

      tTitle.value = ticket.title || "";
      tDesc.value = ticket.description || "";
      tStatus.value = ticket.status || "open";
      tPriority.value = ticket.priority || "normal";
      tRequesterName.value = ticket.requester_name || "";
      tRequesterEmail.value = ticket.requester_email || "";
      tAssigned.value = ticket.assigned_to || "";

      openModal(modalTicketOverlay);
      return;
    }

    if (action === "delete") {
      const ok = confirm(`Excluir o chamado #${ticket.ticket_no || "-"}? Essa ação não pode ser desfeita.`);
      if (!ok) return;

      // remove na tela imediatamente
      removeTicketOptimistic(id);

      try {
        await deleteTicket(id);
        showToast("Chamado excluído");
        reloadDashboard(); // atualiza dashboard automático
      } catch {
        showToast("Falha ao excluir (recarregando...)", false);
        await reloadTickets();
        await reloadDashboard();
      }
      return;
    }

    if (action === "notify") {
      notifyingTicketId = id;
      ticketNotifySubtitle.textContent = `Chamado #${ticket.ticket_no || "-"} • vai para: ${ticket.requester_email || "sem email"}`;
      ticketNotifyTitle.value = `Atualização do chamado #${ticket.ticket_no || ""}`.trim();
      ticketNotifyDesc.value = "";
      openModal(modalTicketNotifyOverlay);
      return;
    }
  });

  // ✅ SALVAR TICKET: fecha modal ao clicar em salvar + atualiza automático
  saveTicketBtn.addEventListener("click", async () => {
    const payload = {
      title: (tTitle.value || "").trim(),
      description: (tDesc.value || "").trim(),
      status: tStatus.value,
      priority: tPriority.value,
      requester_name: (tRequesterName.value || "").trim(),
      requester_email: (tRequesterEmail.value || "").trim(),
      assigned_to: (tAssigned.value || "").trim()
    };

    if (!payload.title || !payload.description) {
      showToast("Preencha título e descrição", false);
      return;
    }

    closeModal(modalTicketOverlay);

    const oldHtml = saveTicketBtn.innerHTML;
    saveTicketBtn.disabled = true;
    saveTicketBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;">
      <span style="width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.65);border-top-color:#fff;display:inline-block;animation:spin .8s linear infinite;"></span>
      Salvando...
    </span>`;

    try {
      if (isTicketCreate) {
        const created = await createTicket(payload);
        upsertTicketOptimistic(created);
        showToast("Chamado criado");
      } else {
        const updated = await patchTicket(editingTicketId, payload);
        upsertTicketOptimistic(updated);
        showToast("Chamado atualizado");
      }
      reloadDashboard();
    } catch {
      showToast("Falha ao salvar (recarregando...)", false);
      await reloadTickets();
      await reloadDashboard();
    } finally {
      saveTicketBtn.disabled = false;
      saveTicketBtn.innerHTML = oldHtml;
    }
  });

  // ✅ ENVIAR NOTIFICAÇÃO TICKET: fecha modal ao clicar em enviar
  sendTicketNotifyBtn.addEventListener("click", async () => {
    const payload = {
      title: (ticketNotifyTitle.value || "").trim(),
      description: (ticketNotifyDesc.value || "").trim()
    };

    if (!payload.title || !payload.description) {
      showToast("Preencha título e descrição", false);
      return;
    }

    closeModal(modalTicketNotifyOverlay);

    const oldHtml = sendTicketNotifyBtn.innerHTML;
    sendTicketNotifyBtn.disabled = true;
    sendTicketNotifyBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;">
      <span style="width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.65);border-top-color:#fff;display:inline-block;animation:spin .8s linear infinite;"></span>
      Enviando...
    </span>`;

    try {
      const r = await notifyTicket(notifyingTicketId, payload);
      if (r.email?.sent) showToast("E-mail enviado + notificação criada");
      else showToast("Notificação criada (SMTP OFF)");
      reloadDashboard();
    } catch {
      showToast("Falha ao enviar notificação", false);
    } finally {
      sendTicketNotifyBtn.disabled = false;
      sendTicketNotifyBtn.innerHTML = oldHtml;
    }
  });

  // ---- Users interactions ----
  applyUserBtn.addEventListener("click", () => reloadUsers());
  uqEl.addEventListener("keydown", (e) => { if (e.key === "Enter") reloadUsers(); });

  newUserBtn.addEventListener("click", () => {
    isUserCreate = true;
    editingUserId = null;

    userModalTitle.textContent = "Criar Usuário";
    userModalSubtitle.textContent = "Novo colaborador no sistema";

    uName.value = "";
    uEmail.value = "";
    uPassword.value = "";

    openModal(modalUserOverlay);
  });

  usersBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-user-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.userAction;
    const user = currentUsers.find((u) => u.id === id);
    if (!user) return;

    if (action === "edit") {
      isUserCreate = false;
      editingUserId = id;

      userModalTitle.textContent = "Editar Usuário";
      userModalSubtitle.textContent = `${user.email}`;

      uName.value = user.name || "";
      uEmail.value = user.email || "";
      uPassword.value = "";

      openModal(modalUserOverlay);
      return;
    }

    if (action === "delete") {
      const ok = confirm(`Excluir o usuário "${user.name}"? Essa ação não pode ser desfeita.`);
      if (!ok) return;

      removeUserOptimistic(id);

      try {
        await deleteUser(id);
        showToast("Usuário excluído");
        reloadDashboard();
      } catch {
        showToast("Falha ao excluir (recarregando...)", false);
        await reloadUsers();
        await reloadDashboard();
      }
      return;
    }

    if (action === "notify") {
      notifyingUserId = id;
      userNotifySubtitle.textContent = `Vai para: ${user.email}`;
      userNotifyTitle.value = "Aviso do sistema";
      userNotifyDesc.value = "";
      openModal(modalUserNotifyOverlay);
      return;
    }
  });

  // ✅ SALVAR USER: fecha modal ao clicar em salvar + atualiza automático
  saveUserBtn.addEventListener("click", async () => {
    const payload = {
      name: (uName.value || "").trim(),
      email: (uEmail.value || "").trim(),
      password: (uPassword.value || "").trim()
    };

    if (!payload.name || !payload.email) {
      showToast("Preencha nome e e-mail", false);
      return;
    }

    closeModal(modalUserOverlay);

    const oldHtml = saveUserBtn.innerHTML;
    saveUserBtn.disabled = true;
    saveUserBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;">
      <span style="width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.65);border-top-color:#fff;display:inline-block;animation:spin .8s linear infinite;"></span>
      Salvando...
    </span>`;

    try {
      if (isUserCreate) {
        if (!payload.password) {
          showToast("Informe uma senha para criar o usuário", false);
          openModal(modalUserOverlay);
          return;
        }

        const created = await createUser(payload);
        upsertUserOptimistic(created);
        showToast("Usuário criado");
      } else {
        // em edição, se senha vier vazia não envia
        const patch = { name: payload.name, email: payload.email };
        if (payload.password) patch.password = payload.password;

        const updated = await patchUser(editingUserId, patch);
        upsertUserOptimistic(updated);
        showToast("Usuário atualizado");
      }

      reloadDashboard();
    } catch (e) {
      const msg =
        String(e.message || "").includes("email_in_use") ? "E-mail já está em uso" :
        String(e.message || "").includes("weak_password") ? "Senha fraca (mín. 6)" :
        "Falha ao salvar";

      showToast(msg, false);
      await reloadUsers();
      await reloadDashboard();
    } finally {
      saveUserBtn.disabled = false;
      saveUserBtn.innerHTML = oldHtml;
    }
  });

  // ✅ ENVIAR NOTIFICAÇÃO USER: fecha modal ao clicar em enviar
  sendUserNotifyBtn.addEventListener("click", async () => {
    const payload = {
      title: (userNotifyTitle.value || "").trim(),
      description: (userNotifyDesc.value || "").trim()
    };

    if (!payload.title || !payload.description) {
      showToast("Preencha título e descrição", false);
      return;
    }

    closeModal(modalUserNotifyOverlay);

    const oldHtml = sendUserNotifyBtn.innerHTML;
    sendUserNotifyBtn.disabled = true;
    sendUserNotifyBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;">
      <span style="width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.65);border-top-color:#fff;display:inline-block;animation:spin .8s linear infinite;"></span>
      Enviando...
    </span>`;

    try {
      const r = await notifyUser(notifyingUserId, payload);
      if (r.email?.sent) showToast("E-mail enviado + notificação criada");
      else showToast("Notificação criada (SMTP OFF)");
      reloadDashboard();
    } catch {
      showToast("Falha ao notificar usuário", false);
    } finally {
      sendUserNotifyBtn.disabled = false;
      sendUserNotifyBtn.innerHTML = oldHtml;
    }
  });

  // ---- Reloaders ----
  async function reloadDashboard() {
    try {
      const summary = await fetchSummary();
      renderDashboard(summary);
    } catch {
      showToast("Erro ao carregar dashboard", false);
    }
  }

  async function reloadTickets() {
    try {
      const tickets = await fetchTickets();
      currentTickets = tickets;
      renderTickets(currentTickets);
    } catch {
      showToast("Erro ao carregar chamados", false);
    }
  }

  async function reloadUsers() {
    try {
      const users = await fetchUsers();
      currentUsers = users;
      renderUsers(currentUsers);
    } catch {
      showToast("Erro ao carregar usuários", false);
    }
  }

  async function reloadAll() {
    refreshBtn.disabled = true;
    try {
      await Promise.all([reloadDashboard(), reloadTickets(), reloadUsers()]);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  // ---- Logout / refresh ----
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "./adminLogin.html";
  });

  refreshBtn.addEventListener("click", () => reloadAll());

  // ---- Boot ----
  (async function boot() {
    await loadMe();

    const savedView = localStorage.getItem("ma_admin_view") || "dashboard";
    setView(savedView);

    await reloadAll();
  })();
})();
