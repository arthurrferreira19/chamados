// public/assets/userResetPassword.js
(function () {
  const TOKEN_KEY = "ma_user_token";
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    window.location.href = "./userLogin.html";
    return;
  }

  const newPass = document.getElementById("newPass");
  const newPass2 = document.getElementById("newPass2");
  const saveBtn = document.getElementById("saveBtn");
  const backBtn = document.getElementById("backBtn");

  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");

  function showToast(msg, ok = true) {
    toastMsg.textContent = msg;
    toast.querySelector("i").setAttribute("data-lucide", ok ? "check-circle-2" : "alert-triangle");
    toast.classList.add("show");
    if (window.lucide) lucide.createIcons();
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  async function save() {
    const p1 = (newPass.value || "").trim();
    const p2 = (newPass2.value || "").trim();

    if (!p1 || p1.length < 6) { showToast("Senha fraca (mín. 6)", false); return; }
    if (p1 !== p2) { showToast("As senhas não conferem", false); return; }
    if (p1 === "123456") { showToast("Não use 123456", false); return; }

    saveBtn.disabled = true;
    try {
      const r = await fetch("/api/user/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ new_password: p1 })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        showToast("Erro ao redefinir senha", false);
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      window.location.href = "./userDashboard.html";
    } catch {
      showToast("Erro ao conectar no servidor", false);
    } finally {
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", save);
  newPass2.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });

  backBtn.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "./userLogin.html";
  });
})();
