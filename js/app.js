// js/app.js (COMPLETO)
import { State } from "./state.js";
import { UI } from "./ui.js";
import { Utils } from "./utils.js";
import { Auth } from "./auth.js";

let currentSession = null;

function getRoute() {
  const hash =
    location.hash || State.get().settings.startRoute || "#/dashboard";
  const clean = hash.replace("#/", "");
  const allowed = new Set([
    "login",
    "dashboard",
    "transactions",
    "categories",
    "budgets",
    "goals",
    "reports",
    "consultor",
    "settings",
  ]);
  return allowed.has(clean) ? clean : "dashboard";
}

function syncMonthInput() {
  const monthInput = document.getElementById("monthInput");
  const current = State.get().settings.monthKey;

  if (!monthInput) return;

  monthInput.value = current;

  monthInput.addEventListener("change", async () => {
    const v = monthInput.value; // YYYY-MM
    if (v) {
      State.setMonthKey(v);
      if (currentSession) {
        try {
          await State.syncAllForMonth(v);
        } catch (e) {
          UI.toast("Erro", e.message || "Falha ao sincronizar mês.");
        }
      }
    }
    UI.render(getRoute());
  });
}

function wireMobileMenu() {
  const btnMenu = document.getElementById("btnMenu");
  const sidebar = document.querySelector(".sidebar");

  btnMenu?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-open");
  });

  sidebar?.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a && sidebar.classList.contains("is-open")) {
      sidebar.classList.remove("is-open");
    }
  });
}

function ensureLogoutButton() {
  const headerRight = document.querySelector(".header__right");
  if (!headerRight) return;

  let btn = document.getElementById("btnLogout");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btnLogout";
    btn.className = "btn";
    btn.type = "button";
    btn.textContent = "Sair";
    btn.style.display = "none";
    headerRight.appendChild(btn);
  }

  btn.addEventListener("click", async () => {
    try {
      await Auth.signOut();
      UI.toast("Sessão", "Você saiu da conta.");
      location.hash = "#/login";
    } catch (e) {
      UI.toast("Erro", e.message || "Falha ao sair.");
    }
  });
}

function updateHeaderAuthUI() {
  const btnLogout = document.getElementById("btnLogout");
  const btnQuickAdd = document.getElementById("btnQuickAdd");
  const monthInput = document.getElementById("monthInput");

  const isLogged = !!currentSession;

  if (btnLogout) btnLogout.style.display = isLogged ? "inline-flex" : "none";
  if (btnQuickAdd) btnQuickAdd.disabled = !isLogged;
  if (monthInput) monthInput.disabled = !isLogged;

  // Show the logged user (email) in the header
  const headerRight = document.querySelector(".header__right");
  if (!headerRight) return;

  let userChip = document.getElementById("userChip");
  if (!userChip) {
    userChip = document.createElement("span");
    userChip.id = "userChip";
    userChip.className = "badge";
    userChip.style.display = "none";
    userChip.style.maxWidth = "220px";
    userChip.style.overflow = "hidden";
    userChip.style.textOverflow = "ellipsis";
    userChip.style.whiteSpace = "nowrap";
    // Put it before the month picker for better layout
    const monthPicker = document.querySelector(".month-picker");
    if (monthPicker && monthPicker.parentElement === headerRight) {
      headerRight.insertBefore(userChip, monthPicker);
    } else {
      headerRight.prepend(userChip);
    }
  }

  if (!isLogged) {
    userChip.style.display = "none";
  } else {
    const email = String(currentSession?.user?.email || "");
    userChip.textContent = email ? `👤 ${email}` : "👤 Logado";
    userChip.style.display = "inline-flex";
  }
}

function wireGlobalModalClosers() {
  // Fecha QUALQUER modal com data-close-modal="idDoDialog"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close-modal]");
    if (!btn) return;

    const id = btn.getAttribute("data-close-modal");
    const modal = document.getElementById(id);
    if (modal && typeof modal.close === "function") modal.close();
  });
}

function wireQuickAdd() {
  const btn = document.getElementById("btnQuickAdd");
  const modal = document.getElementById("quickAddModal");
  const form = document.getElementById("quickAddForm");
  const catSelect = document.getElementById("quickAddCategory");

  const getType = () =>
    String(form?.querySelector('select[name="type"]')?.value || "expense");

  const fillCategories = () => {
    const type = getType(); // expense | income
    const cats = State.listCategories();

    const filtered = cats.filter((c) => {
      if (type === "income") return c.kind === "income" || c.kind === "both";
      return c.kind === "expense" || c.kind === "both";
    });

    catSelect.innerHTML =
      `<option value="" selected disabled>Selecione...</option>` +
      filtered
        .map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`)
        .join("");
  };

  // ✅ função para abrir modal em modo CRIAR
  const openCreate = async () => {
    if (!currentSession) {
      UI.toast("Login", "Faça login para cadastrar lançamentos.");
      location.hash = "#/login";
      return;
    }

    await State.fetchCategories();
    fillCategories();

    form.reset();
    form.querySelector('input[name="id"]').value = "";
    const dateInput = form.querySelector('input[name="date"]');
    if (dateInput) dateInput.value = Utils.todayISO();

    modal.showModal();
  };

  // ✅ função global para abrir em modo EDITAR (UI vai chamar)
  window.PF = window.PF || {};
  window.PF.openEditTransaction = async (txId) => {
    if (!currentSession) return;

    // garante que transações do mês estejam carregadas
    const mk = State.get().settings.monthKey;
    if (!State.listTransactionsByMonth(mk).length) {
      await State.fetchTransactionsByMonth(mk).catch(() => {});
    }

    const tx = State.listTransactionsByMonth(mk).find((t) => t.id === txId);
    if (!tx) {
      UI.toast("Erro", "Lançamento não encontrado.");
      return;
    }

    await State.fetchCategories();
    form.reset();

    // preenche campos
    form.querySelector('input[name="id"]').value = tx.id;
    form.querySelector('select[name="type"]').value = tx.type;
    fillCategories(); // depois de setar type
    form.querySelector('input[name="date"]').value = tx.date;
    form.querySelector('input[name="description"]').value = tx.description;
    form.querySelector('input[name="amount"]').value = String(
      tx.amount,
    ).replace(".", ",");
    form.querySelector('select[name="categoryId"]').value = tx.categoryId;
    form.querySelector('select[name="paymentMethod"]').value =
      tx.paymentMethod || "pix";

    modal.showModal();
  };

  btn?.addEventListener("click", openCreate);

  // ✅ quando mudar o tipo, refaz lista de categorias
  form?.querySelector('select[name="type"]')?.addEventListener("change", () => {
    fillCategories();
  });

  // ✅ submit: cria OU edita dependendo do hidden id
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentSession) {
      UI.toast("Login", "Faça login para salvar.");
      modal.close();
      location.hash = "#/login";
      return;
    }

    const fd = new FormData(form);

    const id = String(fd.get("id") || "");
    const type = String(fd.get("type") || "expense");
    const date = String(fd.get("date") || "");
    const description = String(fd.get("description") || "").trim();
    const amountStr = String(fd.get("amount") || "");
    const categoryId = String(fd.get("categoryId") || "");
    const paymentMethod = String(fd.get("paymentMethod") || "pix");

    if (!categoryId) {
      UI.toast("Erro", "Selecione uma categoria.");
      return;
    }

    const amount = Utils.parseBRLToNumber(amountStr);
    if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
      UI.toast("Erro", "Preencha data, descrição e um valor válido.");
      return;
    }

    try {
      if (!id) {
        await State.addTransaction({
          type,
          date,
          description,
          amount,
          categoryId,
          paymentMethod,
        });
        UI.toast("Salvo", "Lançamento criado.");
      } else {
        await State.updateTransaction(id, {
          type,
          date,
          description,
          amount,
          categoryId,
          paymentMethod,
        });
        UI.toast("Salvo", "Lançamento atualizado.");
      }

      modal.close();

      const mk = State.get().settings.monthKey;
      await State.fetchTransactionsByMonth(mk).catch(() => {});
      UI.render(getRoute());
    } catch (err) {
      UI.toast("Erro", err.message || "Falha ao salvar lançamento.");
    }
  });

  modal?.addEventListener("close", () => {
    form?.reset();
  });
}

function render() {
  const route = getRoute();

  // Guard: se não estiver logado, só permite login
  if (!currentSession && route !== "login") {
    location.hash = "#/login";
    return;
  }

  State.setSession(currentSession);
  UI.setSession(currentSession);

  UI.render(route);
  updateHeaderAuthUI();
  document.getElementById("appMain")?.focus();
}

async function initAuth() {
  try {
    currentSession = await Auth.getSession();
  } catch {
    currentSession = null;
  }

  // repassa sessao pro State logo no inicio
  State.setSession(currentSession);

  // Render immediately (fast), then sync month data
  render();

  if (currentSession) {
    const mk = State.get().settings.monthKey;
    // do not block first paint
    State.syncAllForMonth(mk)
      .then(() => {
        // rerender to reflect fresh data
        UI.render(getRoute());
      })
      .catch(() => {});
  }

  Auth.onAuthStateChange(async (session) => {
    currentSession = session || null;
    State.setSession(currentSession);

    // fast render first
    render();

    if (currentSession) {
      const mk = State.get().settings.monthKey;
      State.syncAllForMonth(mk)
        .then(() => UI.render(getRoute()))
        .catch(() => {});
    }
  });
}

async function init() {
  State.load();

  ensureLogoutButton();
  syncMonthInput();
  wireMobileMenu();
  wireGlobalModalClosers();
  wireQuickAdd();

  await initAuth();

  window.addEventListener("hashchange", render);

  if (!location.hash) {
    location.hash = State.get().settings.startRoute || "#/dashboard";
  }

  if (!currentSession && getRoute() !== "login") {
    location.hash = "#/login";
  }

  render();
}

init();
