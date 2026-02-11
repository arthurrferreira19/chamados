// public/assets/userLogin.js
(function () {
  const TOKEN_KEY = "ma_user_token";

  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");

  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");

  function showToast(msg, ok = true) {
    toastMsg.textContent = msg;
    toast.querySelector("i").setAttribute("data-lucide", ok ? "check-circle-2" : "alert-triangle");
    toast.classList.add("show");
    if (window.lucide) lucide.createIcons();
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  async function login() {
    const email = (emailEl.value || "").trim();
    const password = (passEl.value || "").trim();

    if (!email || !password) {
      showToast("Informe e-mail e senha", false);
      return;
    }

    loginBtn.disabled = true;

    try {
      const r = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        showToast("Credenciais inválidas", false);
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);

      if (data.user?.must_reset_password) {
        window.location.href = "./userResetPassword.html";
      } else {
        window.location.href = "./userDashboard.html";
      }
    } catch {
      showToast("Erro ao conectar no servidor", false);
    } finally {
      loginBtn.disabled = false;
    }
  }

  loginBtn.addEventListener("click", login);
  passEl.addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
})();
