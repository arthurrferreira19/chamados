(function () {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const errorBox = document.getElementById("errorBox");
  const submitBtn = document.getElementById("submitBtn");
  const togglePass = document.getElementById("togglePass");

  const TOKEN_KEY = "ma_admin_token";

  // Se já estiver logado, vai direto
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) {
    window.location.href = "./adminDashboard.html";
    return;
  }

  togglePass.addEventListener("click", () => {
    const isPass = passEl.type === "password";
    passEl.type = isPass ? "text" : "password";
    togglePass.innerHTML = isPass
      ? '<i data-lucide="eye-off" class="icon"></i>'
      : '<i data-lucide="eye" class="icon"></i>';
    if (window.lucide) lucide.createIcons();
    passEl.focus();
  });

  function showError(msg) {
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  }
  function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = (emailEl.value || "").trim().toLowerCase();
    const password = passEl.value || "";

    if (!email || !password) {
      showError("Preencha e-mail e senha.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.9";
    submitBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;">
      <span style="width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.65);border-top-color:#fff;display:inline-block;animation:spin .8s linear infinite;"></span>
      Entrando...
    </span>`;

    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data.ok) {
        showError("E-mail ou senha inválidos.");
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      window.location.href = "./adminDashboard.html";
    } catch (err) {
      showError("Falha de conexão. Tente novamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.innerHTML = `<i data-lucide="log-in" class="icon" style="color:white;"></i> Entrar`;
      if (window.lucide) lucide.createIcons();
    }
  });

  // inject spinner keyframes
  const style = document.createElement("style");
  style.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
  document.head.appendChild(style);
})();
