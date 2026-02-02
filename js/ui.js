import { Utils } from "./utils.js";
import { State } from "./state.js";
import { Charts } from "./charts.js";

function setActiveRouteLinks(route) {
  document.querySelectorAll("[data-route]").forEach((a) => {
    const r = a.getAttribute("data-route");
    a.classList.toggle("is-active", r === route);
  });
}

function setHeader(title, subtitle) {
  const t = document.getElementById("pageTitle");
  const s = document.getElementById("pageSubtitle");
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle || "";
}

export const UI = {
  _session: null,

  setSession(session) {
    this._session = session || null;
  },

  toast(title, msg) {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `
      <div class="toast__title"></div>
      <div class="toast__msg"></div>
    `;
    el.querySelector(".toast__title").textContent = title;
    el.querySelector(".toast__msg").textContent = msg || "";
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  render(route) {
    const main = document.getElementById("appMain");
    if (!main) return;

    // Always clear previous screen first
    main.innerHTML = "";

    try {
      setActiveRouteLinks(route);

      const monthKey = State.get().settings.monthKey;

      // LOGIN
      if (route === "login") {
        setHeader("Login", "Acesse sua conta");
        main.innerHTML = this._login();
        this._wireLogin();
        return;
      }

      // (Se chegou aqui, está logado — app.js protege rota)
      if (route === "dashboard") {
        setHeader("Dashboard", `Mês: ${monthKey}`);
        main.innerHTML = this._dashboard(monthKey);
        this._wireDashboard(monthKey);
        return;
      }

      if (route === "transactions") {
        setHeader("Lançamentos", "Receitas e despesas");
        main.innerHTML = this._transactions(monthKey);
        this._wireTransactions(monthKey);
        return;
      }

      if (route === "categories") {
        setHeader("Categorias", "Crie, edite e exclua");
        main.innerHTML = this._categories();
        this._wireCategories();
        return;
      }

      if (route === "budgets") {
        setHeader("Orçamentos", `Planejamento do mês ${monthKey}`);
        main.innerHTML = this._budgets(monthKey);
        this._wireBudgets(monthKey);
        return;
      }

      if (route === "goals") {
        setHeader("Metas", "Economize com objetivo");
        main.innerHTML = this._goals();
        this._wireGoals();
        return;
      }

      if (route === "reports") {
        setHeader("Relatórios", "Análises por período");
        main.innerHTML = this._reports();
        this._wireReports();
        return;
      }

      if (route === "settings") {
        setHeader("Configurações", "Preferências e dados");
        main.innerHTML = this._settings();
        this._wireSettings();
        return;
      }

      if (route === "consultor") {
        setHeader("Consultor", "Plano para melhorar suas finanças");
        main.innerHTML = this._consultor(State.get().settings.monthKey);
        this._wireConsultor();
        return;
      }

      setHeader("Ops", "Rota não encontrada");
      main.innerHTML = this._placeholder(
        "Não encontrado",
        "Volte ao Dashboard.",
      );
    } catch (err) {
      console.error(err);
      setHeader("Erro", "Falha ao renderizar a tela");
      main.innerHTML = this._placeholder(
        "Erro",
        err?.message || "Ocorreu um erro nesta tela. Veja o console.",
      );
    }
  },

  _dashboardTransactions(monthKey) {
    const tx = State.listTransactionsByMonth(monthKey);
    const prefs = State.getConsultorPrefs();
    if (!prefs.useProfileOnDashboard) return tx;
    const profile = State.getConsultorProfile();
    const virtual = this._buildProfileTransactions(monthKey, profile);
    return [...virtual, ...tx];
  },

  _transactionsList(monthKey) {
    const tx = State.listTransactionsByMonth(monthKey);
    const prefs = State.getConsultorPrefs();
    if (!prefs.useProfileOnTransactions) return tx;
    const profile = State.getConsultorProfile();
    const virtual = this._buildProfileTransactions(monthKey, profile);
    return [...virtual, ...tx];
  },

  _buildProfileTransactions(monthKey, profile) {
    const cats = State.listCategories();
    const normalize = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

    const findCatId = (names, kind) => {
      const nset = new Set((names || []).map(normalize));
      const direct = cats.find((c) => {
        if (kind && c.kind !== kind && c.kind !== "both") return false;
        return nset.has(normalize(c.name));
      });
      if (direct) return direct.id;
      const any = cats.find((c) => !kind || c.kind === kind || c.kind === "both");
      return any?.id || "";
    };

    const today = Utils.todayISO();
    const inMonth = (iso) => String(iso || "").slice(0, 7) === monthKey;
    const baseDate = inMonth(today) ? today : `${monthKey}-05`;

    const salary = Number(profile.salary) || 0;
    const debtCreditCard = Number(profile.debtCreditCard) || 0;
    const debtOverdraft = Number(profile.debtOverdraft) || 0;
    const condoOverdue = Number(profile.condoOverdue) || 0;
    const condoUpcoming = Number(profile.condoUpcoming) || 0;
    const condoUpcomingDue = profile.condoUpcomingDue || `${monthKey}-15`;

    const salaryCat = findCatId(["salario", "salário"], "income");
    const houseCat = findCatId(["casa", "moradia", "condominio", "condomínio"], "expense");
    const otherCat = findCatId(["outros", "dividas", "dívidas"], "expense");

    const virtual = [];
    const pushTx = (t) => {
      if (!t.amount || t.amount <= 0) return;
      virtual.push(t);
    };

    pushTx({
      id: "virtual-income-salary",
      type: "income",
      date: baseDate,
      amount: salary,
      categoryId: salaryCat,
      description: "Salário",
      paymentMethod: "transferencia",
      isVirtual: true,
      virtualType: "salary",
    });

    pushTx({
      id: "virtual-expense-cc",
      type: "expense",
      date: `${monthKey}-03`,
      amount: debtCreditCard,
      categoryId: otherCat,
      description: "Dívida cartão de crédito",
      paymentMethod: "credito",
      isVirtual: true,
      virtualType: "debtCreditCard",
    });

    pushTx({
      id: "virtual-expense-od",
      type: "expense",
      date: `${monthKey}-04`,
      amount: debtOverdraft,
      categoryId: otherCat,
      description: "Dívida cheque especial",
      paymentMethod: "transferencia",
      isVirtual: true,
      virtualType: "debtOverdraft",
    });

    pushTx({
      id: "virtual-expense-condo-overdue",
      type: "expense",
      date: `${monthKey}-01`,
      amount: condoOverdue,
      categoryId: houseCat,
      description: "Condomínio em atraso",
      paymentMethod: "boleto",
      isVirtual: true,
      virtualType: "condoOverdue",
    });

    pushTx({
      id: "virtual-expense-condo-upcoming",
      type: "expense",
      date: inMonth(condoUpcomingDue) ? condoUpcomingDue : `${monthKey}-15`,
      amount: condoUpcoming,
      categoryId: houseCat,
      description: "Condomínio a vencer",
      paymentMethod: "boleto",
      isVirtual: true,
      virtualType: "condoUpcoming",
    });

    return virtual;
  },

  // ------------------- BUDGETS -------------------
  _budgets(monthKey) {
    const allCats = State.listCategories().filter(
      (c) => c.kind === "expense" || c.kind === "both",
    );

    const cats = allCats.filter(
      (c) => !State.isBudgetRowHidden(monthKey, c.id),
    );

    const tx = State.listTransactionsByMonth(monthKey).filter(
      (t) => t.type === "expense",
    );

    const spentByCat = new Map();
    for (const t of tx) {
      spentByCat.set(
        t.categoryId,
        (spentByCat.get(t.categoryId) || 0) + t.amount,
      );
    }

    const budgetMap = State.budgetsForMonth(monthKey); // Map(catId -> number)

    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );

    // categorias que ainda NÃO tem orçamento salvo
    const catsWithoutBudget = allCats.filter((c) => !(budgetMap.get(c.id) > 0));

    const rows = cats
      .map((c) => {
        const spent = spentByCat.get(c.id) || 0;
        const budget = budgetMap.get(c.id) || 0;

        const pct = budget > 0 ? Math.min(999, (spent / budget) * 100) : 0;
        const status =
          budget === 0 ? "—" : pct >= 100 ? "🚨" : pct >= 80 ? "⚠️" : "✅";

        const budgetStr = budget > 0 ? budget.toFixed(2).replace(".", ",") : "";

        const cls =
          budget === 0 ? "" : pct >= 100 ? "danger" : pct >= 80 ? "warn" : "ok";

        const pctText = budget > 0 ? `${pct.toFixed(0)}%` : "";

        return `
        <tr>
          <td>${this._escape(`${c.icon} ${c.name}`)}</td>
          <td>${fmt(spent)}</td>

          <td>
            <input
              class="budget-input"
              data-cat="${c.id}"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="0,00"
              value="${budgetStr}"
            />
          </td>

          <td>
  <span class="budget-status ${cls}">
    ${status}
  </span>
</td>

<td class="muted small">
  ${pctText}
  ${
    budget > 0
      ? `
    <div class="budget-bar ${cls}" style="margin-top:6px">
      <div style="width:${Math.min(100, pct).toFixed(0)}%"></div>
    </div>
  `
      : ""
  }
</td>


          <td style="text-align:right">
            <div class="tx-actions">
              <button class="btn tx-btn" type="button"
                data-action="edit-budget" data-cat="${c.id}" aria-label="Editar">
                <span class="tx-ico">✏️</span><span class="tx-txt">Editar</span>
              </button>

              <button class="btn tx-btn" type="button"
                data-action="delete-budget" data-cat="${c.id}" aria-label="Excluir">
                <span class="tx-ico">✖️</span><span class="tx-txt">Excluir</span>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    const totalSpent = tx.reduce((a, b) => a + b.amount, 0);
    let totalBudget = 0;
    budgetMap.forEach((v) => (totalBudget += Number(v) || 0));

    return `
    <section class="card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">Orçamento por categoria</div>
          <div class="muted small">Digite e salve (Enter ou sair do campo). Excluir remove do Supabase e esconde a linha deste mês.</div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn" id="btnUnhideBudgets" type="button">Restaurar linhas</button>
          <span class="badge">Gasto: ${fmt(totalSpent)} • Orçado: ${fmt(totalBudget)}</span>
        </div>
      </div>

      <!-- ✅ NOVO: adicionar orçamento para uma categoria -->
      <div class="card" style="margin-top:12px;padding:12px;border-radius:14px">
        <div class="muted small" style="margin-bottom:8px">Adicionar orçamento</div>
        <div class="grid">
          <label class="field span-2">
            <span>Categoria</span>
            <select id="budgetAddCat">
              ${
                catsWithoutBudget.length
                  ? catsWithoutBudget
                      .map(
                        (c) =>
                          `<option value="${c.id}">${this._escape(`${c.icon} ${c.name}`)}</option>`,
                      )
                      .join("")
                  : `<option value="">Todas as categorias já têm orçamento</option>`
              }
            </select>
          </label>

          <label class="field">
            <span>Valor</span>
            <input id="budgetAddVal" type="text" inputmode="decimal" placeholder="0,00" />
          </label>

          <div class="field" style="justify-content:flex-end">
            <span>&nbsp;</span>
            <button class="btn primary" id="btnAddBudget" type="button" ${
              catsWithoutBudget.length ? "" : "disabled"
            }>Adicionar</button>
          </div>
        </div>
      </div>

      <div style="margin-top:12px; overflow:auto;">
        <table class="table" id="budgetTable" aria-label="Tabela de orçamentos">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Gasto</th>
              <th>Orçamento</th>
              <th>Status</th>
              <th>%</th>
              <th style="text-align:right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="muted">Sem categorias de despesa.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
  },

  _wireBudgets(monthKey) {
    const table = document.getElementById("budgetTable");
    if (!table) return;

    const btnUnhide = document.getElementById("btnUnhideBudgets");
    btnUnhide?.addEventListener("click", () => {
      State.unhideAllBudgetRows(monthKey);
      this.toast("Ok", "Linhas restauradas.");
      this.render("budgets");
    });

    // máscara simples BRL (sempre 2 casas)
    const maskBRL = (raw) => {
      const digits = String(raw || "").replace(/\D/g, "");
      if (!digits) return "";
      const cents = Number(digits) / 100;
      return cents.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const saveInput = async (inputEl) => {
      const catId = inputEl.getAttribute("data-cat");
      if (!catId) return;

      const num = Utils.parseBRLToNumber(String(inputEl.value || "0"));
      if (!Number.isFinite(num) || num < 0) {
        this.toast("Erro", "Valor inválido.");
        return;
      }

      try {
        if (!num) {
          // 0 / vazio => remove do supabase
          await State.deleteBudget(monthKey, catId);
          inputEl.value = "";
          this.toast("Removido", "Orçamento excluído.");
        } else {
          await State.upsertBudget(monthKey, catId, num);
          inputEl.value = num.toFixed(2).replace(".", ",");
          this.toast("Salvo", "Orçamento atualizado.");
        }

        await State.fetchBudgetsByMonth(monthKey).catch(() => {});
        this.render("budgets");
      } catch (err) {
        this.toast("Erro", err?.message || "Falha ao salvar orçamento.");
      }
    };

    // inputs existentes
    const inputs = table.querySelectorAll(".budget-input");
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        inp.value = maskBRL(inp.value);
        try {
          inp.setSelectionRange(inp.value.length, inp.value.length);
        } catch {}
      });

      inp.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        await saveInput(inp);
      });

      inp.addEventListener("blur", async () => {
        await saveInput(inp);
      });
    });

    // botões da tabela
    table.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const catId = btn.getAttribute("data-cat");
      if (!catId) return;

      if (action === "edit-budget") {
        const input = table.querySelector(`.budget-input[data-cat="${catId}"]`);
        if (input) {
          input.focus();
          input.select();
        }
        return;
      }

      if (action === "delete-budget") {
        const ok = confirm(
          "Remover esta categoria do Orçamento (somente nesta tela/mês)?",
        );
        if (!ok) return;

        try {
          await State.deleteBudget(monthKey, catId); // remove do supabase
          State.hideBudgetRow(monthKey, catId); // esconde permanentemente (local uiPrefs)
          this.toast("Ok", "Linha removida do Orçamento.");
          await State.fetchBudgetsByMonth(monthKey).catch(() => {});
          this.render("budgets");
        } catch (err) {
          this.toast("Erro", err?.message || "Falha ao remover.");
        }
      }
    });

    // ✅ NOVO: adicionar orçamento
    const addCat = document.getElementById("budgetAddCat");
    const addVal = document.getElementById("budgetAddVal");
    const addBtn = document.getElementById("btnAddBudget");

    const applyMask = (el) => {
      el.addEventListener("input", () => {
        el.value = maskBRL(el.value);
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {}
      });
    };
    if (addVal) applyMask(addVal);

    addBtn?.addEventListener("click", async () => {
      const catId = String(addCat?.value || "");
      if (!catId) return this.toast("Ops", "Escolha uma categoria.");

      const num = Utils.parseBRLToNumber(String(addVal?.value || "0"));
      if (!Number.isFinite(num) || num <= 0) {
        return this.toast("Ops", "Informe um valor maior que zero.");
      }

      try {
        await State.upsertBudget(monthKey, catId, num);

        // se a categoria estava escondida, reexibe ao adicionar
        State.unhideBudgetRow?.(monthKey, catId);

        this.toast("Ok", "Orçamento criado.");
        await State.fetchBudgetsByMonth(monthKey).catch(() => {});
        this.render("budgets");
      } catch (err) {
        this.toast("Erro", err?.message || "Falha ao criar orçamento.");
      }
    });
  },

  // ------------------- GOALS -------------------
  _goals() {
    const goals = State.listGoals();
    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );

    return `
      <section class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-weight:800">Metas</div>
            <div class="muted small">Crie metas e registre aportes</div>
          </div>
          <button class="btn primary" id="btnNewGoal">+ Nova meta</button>
        </div>

        <div style="margin-top:12px" class="grid" id="goalsGrid">
          ${goals
            .map((g) => {
              const pct = Math.min(
                100,
                (g.currentAmount / g.targetAmount) * 100,
              );
              const left = Math.max(0, g.targetAmount - g.currentAmount);
              return `
              <div class="card" style="padding:12px;border-radius:14px">
                <div style="display:flex;justify-content:space-between;gap:10px">
                  <div style="min-width:0">
                    <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this._escape(g.name)}</div>
                    <div class="muted small">Alvo: ${fmt(g.targetAmount)} • Atual: ${fmt(g.currentAmount)}</div>
                    ${g.deadline ? `<div class="muted small">Prazo: ${g.deadline}</div>` : ""}
                  </div>
                  <span class="badge">${pct.toFixed(0)}%</span>
                </div>

                <div style="height:10px;background:rgba(255,255,255,0.08);border-radius:999px;margin-top:10px;overflow:hidden">
                  <div style="height:10px;width:${pct}%;background:rgba(109,94,252,0.75)"></div>
                </div>

                <div class="muted small" style="margin-top:8px">Falta: ${fmt(left)}</div>

                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px">
                  <button class="btn" data-action="add-contr" data-id="${g.id}">Aporte</button>
                  <button class="btn" data-action="edit-goal" data-id="${g.id}">Editar</button>
                  <button class="btn" data-action="del-goal" data-id="${g.id}">Excluir</button>
                </div>
              </div>
            `;
            })
            .join("")}
          ${goals.length === 0 ? `<div class="muted">Nenhuma meta criada ainda.</div>` : ""}
        </div>
      </section>
    `;
  },

  _wireGoals() {
    const btnNew = document.getElementById("btnNewGoal");
    const grid = document.getElementById("goalsGrid");

    // MODAIS (fixos no index.html, então NÃO pode acumular listeners)
    const goalModal = document.getElementById("goalModal");
    const goalForm = document.getElementById("goalForm");
    const goalTitle = document.getElementById("goalModalTitle");

    const contrModal = document.getElementById("contrModal");
    const contrForm = document.getElementById("contrForm");
    const contrTitle = document.getElementById("contrModalTitle");

    const bindMoney = (el) => {
      if (!el || el.dataset.moneyBound) return;
      el.dataset.moneyBound = "1";
      el.addEventListener("input", () => {
        el.value = Utils.moneyMaskBRL(el.value);
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {}
      });
    };

    bindMoney(goalForm?.querySelector('input[name="targetAmount"]'));
    bindMoney(contrForm?.querySelector('input[name="amount"]'));

    const openGoalCreate = () => {
      goalTitle.textContent = "Nova meta";
      goalForm.reset();
      goalForm.querySelector('input[name="id"]').value = "";
      goalModal.showModal();
    };

    const openGoalEdit = (g) => {
      goalTitle.textContent = "Editar meta";
      goalForm.reset();
      goalForm.querySelector('input[name="id"]').value = g.id;
      goalForm.querySelector('input[name="name"]').value = g.name;
      goalForm.querySelector('input[name="targetAmount"]').value = String(
        g.targetAmount,
      ).replace(".", ",");
      goalForm.querySelector('input[name="deadline"]').value = g.deadline || "";
      goalForm.querySelector('textarea[name="notes"]').value = g.notes || "";
      goalModal.showModal();
    };

    const openContribution = (g) => {
      contrTitle.textContent = `Aporte: ${g.name}`;
      contrForm.reset();
      contrForm.querySelector('input[name="goalId"]').value = g.id;
      contrModal.showModal();
    };

    // ✅ NÃO usar addEventListener aqui nos elementos fixos, use atribuição (não duplica)
    if (btnNew) btnNew.onclick = openGoalCreate;

    if (grid) {
      grid.onclick = async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const goals = State.listGoals();
        const g = goals.find((x) => x.id === id);
        if (!g) return;

        if (action === "edit-goal") return openGoalEdit(g);
        if (action === "add-contr") return openContribution(g);

        if (action === "del-goal") {
          const ok = confirm(`Excluir a meta "${g.name}"?`);
          if (!ok) return;
          try {
            await State.deleteGoal(g.id);
            this.toast("Ok", "Meta excluída.");
            await State.fetchGoals().catch(() => {});
            this.render("goals");
          } catch (err) {
            this.toast("Erro", err.message || "Falha ao excluir.");
          }
        }
      };
    }

    if (goalForm) {
      goalForm.onsubmit = async (e) => {
        e.preventDefault();

        const fd = new FormData(goalForm);
        const id = String(fd.get("id") || "");
        const name = String(fd.get("name") || "").trim();
        const targetAmount = Utils.parseBRLToNumber(
          String(fd.get("targetAmount") || ""),
        );
        const deadline = String(fd.get("deadline") || "").trim() || null;
        const notes = String(fd.get("notes") || "");

        if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) {
          this.toast("Erro", "Informe nome e um valor alvo válido.");
          return;
        }

        try {
          if (!id) {
            await State.addGoal({ name, targetAmount, deadline, notes });
            this.toast("Salvo", "Meta criada.");
          } else {
            await State.updateGoal(id, { name, targetAmount, deadline, notes });
            this.toast("Salvo", "Meta atualizada.");
          }

          goalModal.close();
          await State.fetchGoals().catch(() => {});
          this.render("goals");
        } catch (err) {
          this.toast("Erro", err.message || "Falha ao salvar meta.");
        }
      };
    }

    if (contrForm) {
      contrForm.onsubmit = async (e) => {
        e.preventDefault();

        const fd = new FormData(contrForm);
        const goalId = String(fd.get("goalId") || "");
        const amount = Utils.parseBRLToNumber(String(fd.get("amount") || ""));

        if (!goalId || !Number.isFinite(amount) || amount <= 0) {
          this.toast("Erro", "Informe um valor de aporte válido.");
          return;
        }

        try {
          await State.addContribution(goalId, amount);
          this.toast("Ok", "Aporte registrado.");
          contrModal.close();
          await State.fetchGoals().catch(() => {});
          this.render("goals");
        } catch (err) {
          this.toast("Erro", err.message || "Falha ao registrar aporte.");
        }
      };
    }

    if (goalModal) goalModal.onclose = () => goalForm?.reset();
    if (contrModal) contrModal.onclose = () => contrForm?.reset();
  },

  // ------------------- CONSULTOR -------------------
  _consultor(monthKey) {
    const a = this._analyzeTransactions(
      this._transactionsList(monthKey),
      monthKey,
    );
    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );
    const pct = (v) => `${(v * 100).toFixed(0)}%`;
    const cats = new Map(State.listCategories().map((c) => [c.id, c]));
    const brlInput = (v) => Utils.formatNumberBRL(v);
    const fmtDate = (iso) => {
      if (!iso) return "—";
      const [y, m, d] = String(iso).split("-");
      if (!y || !m || !d) return "—";
      return `${d}/${m}/${y}`;
    };

    const score = this._calcScore(a);
    const scoreLabel =
      score >= 80
        ? "Excelente"
        : score >= 60
          ? "Bom"
          : score >= 40
            ? "Atenção"
            : "Crítico";

    const plan = this._buildPlan(a);

    const profile = State.getConsultorProfile();
    const prefs = State.getConsultorPrefs();
    const essentialIds = new Set(prefs.essentialCategoryIds || []);

    const salary = Number(profile.salary) || a.income || 0;
    const debtCreditCard = Number(profile.debtCreditCard) || 0;
    const debtOverdraft = Number(profile.debtOverdraft) || 0;
    const condoOverdue = Number(profile.condoOverdue) || 0;
    const condoUpcoming = Number(profile.condoUpcoming) || 0;
    const condoUpcomingDue = profile.condoUpcomingDue || "";

    const totalDebt =
      debtCreditCard + debtOverdraft + condoOverdue + condoUpcoming;
    const urgentDebt = condoOverdue + condoUpcoming;

    const debtPaymentTarget =
      Number(prefs.debtPaymentTarget) > 0
        ? Number(prefs.debtPaymentTarget)
        : Math.round(salary * 0.3);
    const debtMonths =
      debtPaymentTarget > 0 ? Math.ceil(totalDebt / debtPaymentTarget) : null;

    const debtPlan = this._buildDebtPlan(
      {
        salary,
        debtCreditCard,
        debtOverdraft,
        condoOverdue,
        condoUpcoming,
        condoUpcomingDue,
        debtPaymentTarget,
      },
      a,
    );

    const debtItems = [
      { label: "Cartão de crédito", value: debtCreditCard },
      { label: "Cheque especial", value: debtOverdraft },
      { label: "Condomínio em atraso", value: condoOverdue },
      { label: "Condomínio a vencer", value: condoUpcoming },
    ].filter((x) => x.value > 0);

    const easyGoals = this._buildEasyGoals({
      salary,
      debtPaymentTarget,
      condoOverdue,
      condoUpcoming,
      condoUpcomingDue,
    });
    const easyGoalsStatus = prefs.easyGoalsStatus || {};
    const easyGoalsDone = easyGoals.filter((g) => easyGoalsStatus[g.id]).length;
    const easyGoalsTotal = easyGoals.length || 1;
    const easyGoalsPct = Math.round((easyGoalsDone / easyGoalsTotal) * 100);

    const expenseTx = State.listTransactionsByMonth(monthKey).filter(
      (t) => t.type === "expense",
    );
    const unnecessaryTx = expenseTx.filter(
      (t) => !essentialIds.has(t.categoryId),
    );

    const budgetMode = prefs.budgetSuggestionMode || "monthly";
    const budgetData = this._budgetSuggestions(monthKey, budgetMode, cats);
    const suggestions = budgetData.items;
    const budgetLabel = budgetData.label;

    return `
    <section class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">Diagnóstico do mês ${a.monthKey}</div>
          <div class="muted small">Baseado nos seus lançamentos</div>
        </div>
        <span class="badge">Score: ${score} • ${scoreLabel}</span>
      </div>

      <div class="row" style="margin-top:12px">
        <div class="card">
          <div class="muted small">Receitas</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(a.income)}</div>
        </div>
        <div class="card">
          <div class="muted small">Despesas</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(a.expense)}</div>
        </div>
        <div class="card">
          <div class="muted small">Saldo</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(a.balance)}</div>
          <div class="muted small" style="margin-top:6px">Taxa de poupança: ${pct(a.savingRate)}</div>
        </div>
      </div>

      <div style="margin-top:12px">
        <div style="font-weight:800">Alertas</div>
        ${
          a.alerts.length
            ? `<ul class="muted" style="margin-top:8px">
              ${a.alerts.map((x) => `<li>${this._escape(x)}</li>`).join("")}
            </ul>`
            : `<div class="muted" style="margin-top:8px">Nenhum alerta crítico encontrado. 👌</div>`
        }
      </div>

      <div style="margin-top:14px">
        <div style="font-weight:800">Top despesas por categoria</div>
        <div style="margin-top:10px;overflow:auto">
          <table class="table">
            <thead><tr><th>Categoria</th><th>Total</th></tr></thead>
            <tbody>
              ${
                a.topCats.length
                  ? a.topCats
                      .map(
                        (r) => `
                <tr>
                  <td>${this._escape((r.cat?.icon || "🏷️") + " " + (r.cat?.name || "—"))}</td>
                  <td>${fmt(r.total)}</td>
                </tr>
              `,
                      )
                      .join("")
                  : `<tr><td colspan="2" class="muted">Sem despesas ainda.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">Seu cenário financeiro</div>
          <div class="muted small">Use os campos abaixo para ajustar os números</div>
        </div>
        <span class="badge">Total de dívidas: ${fmt(totalDebt)}</span>
      </div>

      <form class="grid" id="consultorProfileForm" style="margin-top:12px">
        <label class="field">
          <span>Salário líquido</span>
          <input id="consultorSalary" type="text" inputmode="decimal" value="${brlInput(
            salary,
          )}" />
        </label>

        <label class="field">
          <span>Cartão de crédito</span>
          <input id="consultorCC" type="text" inputmode="decimal" value="${brlInput(
            debtCreditCard,
          )}" />
        </label>

        <label class="field">
          <span>Cheque especial</span>
          <input id="consultorOverdraft" type="text" inputmode="decimal" value="${brlInput(
            debtOverdraft,
          )}" />
        </label>

        <label class="field">
          <span>Condomínio em atraso</span>
          <input id="consultorCondoOverdue" type="text" inputmode="decimal" value="${brlInput(
            condoOverdue,
          )}" />
        </label>

        <label class="field">
          <span>Condomínio a vencer</span>
          <input id="consultorCondoUpcoming" type="text" inputmode="decimal" value="${brlInput(
            condoUpcoming,
          )}" />
        </label>

        <label class="field">
          <span>Vencimento (condomínio)</span>
          <input id="consultorCondoDue" type="date" value="${this._escape(
            condoUpcomingDue,
          )}" />
        </label>

        <label class="field span-2">
          <span>Meta mensal para pagar dívidas</span>
          <input id="consultorDebtTarget" type="text" inputmode="decimal" value="${brlInput(
            debtPaymentTarget,
          )}" />
        </label>

        <label class="field span-2" style="flex-direction:row;align-items:center;gap:10px">
          <input id="consultorUseDashboard" type="checkbox" ${
            prefs.useProfileOnDashboard ? "checked" : ""
          } />
          <span>Aplicar estes valores no Dashboard</span>
        </label>

        <label class="field span-2" style="flex-direction:row;align-items:center;gap:10px">
          <input id="consultorUseTransactions" type="checkbox" ${
            prefs.useProfileOnTransactions ? "checked" : ""
          } />
          <span>Aplicar estes valores na aba Lançamentos</span>
        </label>

        <div class="field span-2" style="align-items:flex-end">
          <span>&nbsp;</span>
          <button class="btn primary" type="submit">Salvar números</button>
        </div>
      </form>

      <div class="row" style="margin-top:12px">
        <div class="card">
          <div class="muted small">Dívida urgente</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(
            urgentDebt,
          )}</div>
          <div class="muted small" style="margin-top:6px">Priorize condomínio em atraso + próximo vencimento.</div>
        </div>
        <div class="card">
          <div class="muted small">Meta mensal (dívidas)</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(
            debtPaymentTarget,
          )}</div>
          <div class="muted small" style="margin-top:6px">${
            debtMonths ? `Quita em ~${debtMonths} meses` : "Defina uma meta mensal"
          }</div>
        </div>
        <div class="card">
          <div class="muted small">Próximo vencimento condomínio</div>
          <div style="font-size:20px;font-weight:800;margin-top:6px">${fmtDate(
            condoUpcomingDue,
          )}</div>
          <div class="muted small" style="margin-top:6px">Reserve ${fmt(
            condoUpcoming,
          )} até essa data.</div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="font-weight:800">Gráficos de organização</div>
      <div class="row" style="margin-top:10px">
        <div class="card" style="flex:1;min-width:260px">
          <div class="muted small">Composição das dívidas</div>
          <div style="margin-top:10px">
            ${Charts.donutChartSVG({ items: debtItems, size: 220 })}
          </div>
        </div>
        <div class="card" style="flex:1;min-width:260px">
          <div class="muted small">Fluxo do mês (estimado)</div>
          <div style="margin-top:10px">
            ${Charts.barChartSVG({
              labels: ["Salário", "Despesas mês", "Meta dívidas"],
              values: [salary, a.expense, debtPaymentTarget],
              height: 180,
              width: 520,
            })}
          </div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">Plano de reorganização (passo a passo)</div>
          <div class="muted small">Foco em dívidas e fluxo de caixa</div>
        </div>
        <button class="btn" id="btnCopyDebtPlan" type="button">Copiar plano</button>
      </div>

      <ol style="margin-top:10px">
        ${debtPlan.map((p) => `<li style="margin:10px 0">${this._escape(p)}</li>`).join("")}
      </ol>

      <div class="muted small" style="margin-top:10px">
        Ordem de ataque sugerida: condomínio (urgente) → cheque especial → cartão de crédito.
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="font-weight:800">Categorias essenciais</div>
      <div class="muted small">Marque o que é essencial. O restante vira "gasto desnecessário".</div>

      <div class="grid" style="margin-top:12px">
        ${Array.from(cats.values())
          .filter((c) => c.kind === "expense" || c.kind === "both")
          .map(
            (c) => `
          <label class="field" style="flex-direction:row;align-items:center;gap:10px">
            <input type="checkbox" data-essential-id="${c.id}" ${
              essentialIds.has(c.id) ? "checked" : ""
            } />
            <span>${this._escape(`${c.icon} ${c.name}`)}</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="font-weight:800">Gastos desnecessários do mês</div>
      <div class="muted small">Para cada gasto, reflita antes de repetir.</div>

      <div style="margin-top:10px">
        ${
          unnecessaryTx.length
            ? `<ul class="muted" style="margin-top:8px">
              ${unnecessaryTx
                .map((t) => {
                  const c = cats.get(t.categoryId);
                  const name = c ? `${c.icon} ${c.name}` : "—";
                  return `<li>${this._escape(
                    t.description,
                  )} • ${this._escape(name)} • ${fmt(
                    t.amount,
                  )} — Me aproxima ou me distancia dos meu sonhos e objetivos</li>`;
                })
                .join("")}
            </ul>`
            : `<div class="muted" style="margin-top:8px">Sem gastos desnecessários identificados.</div>`
        }
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="font-weight:800">Metas fáceis (checklist)</div>
      <div class="muted small">Pequenas vitórias para manter o ritmo.</div>

      <div class="row" style="margin-top:10px">
        <div class="card" style="flex:1;min-width:220px">
          <div class="muted small">Progresso</div>
          <div style="font-size:22px;font-weight:900;margin-top:6px">${easyGoalsPct}%</div>
          <div class="muted small" style="margin-top:6px">${easyGoalsDone} de ${easyGoalsTotal} concluídas</div>
          <div class="budget-bar ok" style="margin-top:10px">
            <div style="width:${easyGoalsPct}%"></div>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-top:12px">
        ${easyGoals
          .map(
            (g) => `
          <label class="field" style="flex-direction:row;align-items:center;gap:10px">
            <input type="checkbox" data-easy-goal="${g.id}" ${
              easyGoalsStatus[g.id] ? "checked" : ""
            } />
            <span>${this._escape(g.text)}</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">Plano de ação sugerido</div>
          <div class="muted small">3 passos práticos para o próximo mês</div>
        </div>
        <button class="btn" id="btnCopyPlan" type="button">Copiar plano</button>
      </div>

      <ol style="margin-top:10px">
        ${plan.map((p) => `<li style="margin:10px 0">${this._escape(p)}</li>`).join("")}
      </ol>

      <div class="muted small" style="margin-top:10px">
        Dica: quanto mais você lançar (inclusive despesas pequenas), mais preciso fica o consultor.
      </div>
    </section>

    <div class="card" style="margin-top:12px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <div>
      <div style="font-weight:800">Sugestão de orçamentos</div>
      <div class="muted small">${this._escape(budgetLabel)} (+10% folga)</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <select id="budgetSuggestionMode" class="btn">
        <option value="monthly" ${budgetMode === "monthly" ? "selected" : ""}>Mensal</option>
        <option value="quarterly" ${budgetMode === "quarterly" ? "selected" : ""}>Trimestral</option>
      </select>
      <button class="btn primary" id="btnApplyBudgetSuggestions" type="button">
        Aplicar no mês
      </button>
    </div>
  </div>

  <div style="margin-top:10px; overflow:auto">
    <table class="table" aria-label="Sugestões de orçamento">
      <thead>
        <tr>
          <th>Categoria</th>
          <th>Base</th>
          <th>Sugestão</th>
        </tr>
      </thead>
      <tbody>
        ${
          suggestions.length
            ? suggestions
                .map((sg) => {
                  const c = cats.get(sg.catId);
                  const name = c ? `${c.icon} ${c.name}` : "—";
                  return `
                  <tr>
                    <td>${this._escape(name)}</td>
                    <td>${fmt(sg.avg)}</td>
                    <td><b>${fmt(sg.suggested)}</b></td>
                  </tr>
                `;
                })
                .join("")
            : `<tr><td colspan="3" class="muted">Sem dados suficientes nos últimos 3 meses.</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="muted small" style="margin-top:8px">
    Dica: use isso como ponto de partida. Você pode ajustar na aba Orçamentos.
  </div>
</div>

  `;
  },

  _analyzeTransactions(tx, monthKey) {
    const incomeTx = (tx || []).filter((t) => t.type === "income");
    const expenseTx = (tx || []).filter((t) => t.type === "expense");

    const income = incomeTx.reduce((a, b) => a + b.amount, 0);
    const expense = expenseTx.reduce((a, b) => a + b.amount, 0);
    const balance = income - expense;

    const savingRate = income > 0 ? balance / income : 0;

    const cats = new Map(State.listCategories().map((c) => [c.id, c]));
    const byCat = new Map();
    for (const t of expenseTx) {
      byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount);
    }

    const topCats = [...byCat.entries()]
      .map(([catId, total]) => ({ catId, total, cat: cats.get(catId) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const alerts = [];
    if (income > 0 && expense > income)
      alerts.push("Você gastou mais do que ganhou neste mês.");
    if (income > 0 && savingRate < 0.1)
      alerts.push("Sua taxa de poupança está baixa (abaixo de 10%).");
    if (income > 0 && expense / income > 0.8)
      alerts.push("Despesas acima de 80% da renda (alto risco).");

    return {
      monthKey,
      income,
      expense,
      balance,
      savingRate,
      topCats,
      alerts,
    };
  },

  _wireConsultor() {
    const applyMask = (el) => {
      if (!el || el.dataset.moneyBound) return;
      el.dataset.moneyBound = "1";
      el.addEventListener("input", () => {
        el.value = Utils.moneyMaskBRL(el.value);
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {}
      });
    };

    const profileForm = document.getElementById("consultorProfileForm");
    const salaryEl = document.getElementById("consultorSalary");
    const ccEl = document.getElementById("consultorCC");
    const odEl = document.getElementById("consultorOverdraft");
    const condoOverdueEl = document.getElementById("consultorCondoOverdue");
    const condoUpcomingEl = document.getElementById("consultorCondoUpcoming");
    const condoDueEl = document.getElementById("consultorCondoDue");
    const debtTargetEl = document.getElementById("consultorDebtTarget");
    const useDashboardEl = document.getElementById("consultorUseDashboard");
    const useTransactionsEl = document.getElementById(
      "consultorUseTransactions",
    );

    [salaryEl, ccEl, odEl, condoOverdueEl, condoUpcomingEl, debtTargetEl].forEach(
      applyMask,
    );

    if (profileForm) {
      profileForm.onsubmit = (e) => {
        e.preventDefault();

        const salary = Utils.parseBRLToNumber(String(salaryEl?.value || ""));
        const debtCreditCard = Utils.parseBRLToNumber(String(ccEl?.value || ""));
        const debtOverdraft = Utils.parseBRLToNumber(String(odEl?.value || ""));
        const condoOverdue = Utils.parseBRLToNumber(
          String(condoOverdueEl?.value || ""),
        );
        const condoUpcoming = Utils.parseBRLToNumber(
          String(condoUpcomingEl?.value || ""),
        );
        const condoUpcomingDue = String(condoDueEl?.value || "").trim();
        const debtPaymentTarget = Utils.parseBRLToNumber(
          String(debtTargetEl?.value || ""),
        );
        const useProfileOnDashboard = !!useDashboardEl?.checked;
        const useProfileOnTransactions = !!useTransactionsEl?.checked;

        State.setConsultorProfile({
          salary: Number.isFinite(salary) ? salary : 0,
          debtCreditCard: Number.isFinite(debtCreditCard) ? debtCreditCard : 0,
          debtOverdraft: Number.isFinite(debtOverdraft) ? debtOverdraft : 0,
          condoOverdue: Number.isFinite(condoOverdue) ? condoOverdue : 0,
          condoUpcoming: Number.isFinite(condoUpcoming) ? condoUpcoming : 0,
          condoUpcomingDue: condoUpcomingDue || "",
        });

        State.setConsultorPrefs({
          debtPaymentTarget: Number.isFinite(debtPaymentTarget)
            ? debtPaymentTarget
            : 0,
          useProfileOnDashboard,
          useProfileOnTransactions,
        });

        this.toast("Ok", "Números atualizados.");
        this.render("consultor");
      };
    }

    document
      .querySelectorAll("input[data-essential-id]")
      .forEach((el) => {
        el.addEventListener("change", () => {
          const ids = Array.from(
            document.querySelectorAll("input[data-essential-id]:checked"),
          ).map((i) => i.getAttribute("data-essential-id"));

          State.setConsultorPrefs({ essentialCategoryIds: ids.filter(Boolean) });
          this.render("consultor");
        });
      });

    document
      .querySelectorAll("input[data-easy-goal]")
      .forEach((el) => {
        el.addEventListener("change", () => {
          const map = { ...(State.getConsultorPrefs().easyGoalsStatus || {}) };
          const id = el.getAttribute("data-easy-goal");
          if (!id) return;
          map[id] = !!el.checked;
          State.setConsultorPrefs({ easyGoalsStatus: map });
          this.render("consultor");
        });
      });

    const budgetModeEl = document.getElementById("budgetSuggestionMode");
    budgetModeEl?.addEventListener("change", () => {
      State.setConsultorPrefs({ budgetSuggestionMode: budgetModeEl.value });
      this.render("consultor");
    });

    document
      .getElementById("btnApplyBudgetSuggestions")
      ?.addEventListener("click", async () => {
        const monthKey = State.get().settings.monthKey;
        const budgetMode =
          document.getElementById("budgetSuggestionMode")?.value || "monthly";

        const cats = new Map(State.listCategories().map((c) => [c.id, c]));
        const data = this._budgetSuggestions(monthKey, budgetMode, cats);
        const suggestions = data.items
          .map((x) => ({ catId: x.catId, suggested: x.suggested }))
          .slice(0, 5);

        if (!suggestions.length) {
          this.toast("Ops", "Sem dados suficientes para sugerir orçamentos.");
          return;
        }

        const ok = confirm(
          `Aplicar ${suggestions.length} sugestão(ões) de orçamento neste mês?`,
        );
        if (!ok) return;

        try {
          for (const sg of suggestions) {
            await State.upsertBudget(monthKey, sg.catId, sg.suggested);
          }
          await State.fetchBudgetsByMonth(monthKey).catch(() => {});
          this.toast("Ok", "Sugestões aplicadas no mês.");
          this.render("budgets");
        } catch (e) {
          this.toast("Erro", e?.message || "Falha ao aplicar sugestões.");
        }
      });

    const btnDebtPlan = document.getElementById("btnCopyDebtPlan");
    btnDebtPlan &&
      (btnDebtPlan.onclick = () => {
        const a = State.analyzeMonth(State.get().settings.monthKey);
        const profile = State.getConsultorProfile();
        const prefs = State.getConsultorPrefs();
        const salary = Number(profile.salary) || a.income || 0;
        const debtPaymentTarget =
          Number(prefs.debtPaymentTarget) > 0
            ? Number(prefs.debtPaymentTarget)
            : Math.round(salary * 0.3);

        const plan = this._buildDebtPlan(
          {
            salary,
            debtCreditCard: Number(profile.debtCreditCard) || 0,
            debtOverdraft: Number(profile.debtOverdraft) || 0,
            condoOverdue: Number(profile.condoOverdue) || 0,
            condoUpcoming: Number(profile.condoUpcoming) || 0,
            condoUpcomingDue: profile.condoUpcomingDue || "",
            debtPaymentTarget,
          },
          a,
        );

        const text =
          `Consultor - Plano de reorganização (${State.get().settings.monthKey})\n` +
          plan.map((p, i) => `${i + 1}. ${p}`).join("\n");

        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            this.toast("Copiado", "Plano de reorganização copiado.");
          })
          .catch(() => {
            this.toast("Ops", "Não consegui copiar automaticamente.");
          });
      });

    const btn = document.getElementById("btnCopyPlan");
    btn &&
      (btn.onclick = () => {
        const monthKey = State.get().settings.monthKey;
        const a = State.analyzeMonth(monthKey);
        const plan = this._buildPlan(a);

        const text =
          `Consultor - Plano de ação (${monthKey})\n` +
          plan.map((p, i) => `${i + 1}. ${p}`).join("\n");

        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            this.toast(
              "Copiado",
              "Plano copiado para a área de transferência.",
            );
          })
          .catch(() => {
            this.toast("Ops", "Não consegui copiar automaticamente.");
          });
      });
  },

  _calcScore(a) {
    // score simples: 0..100
    // base: taxa de poupança
    const saving = Math.max(-1, Math.min(1, a.savingRate));
    let score = 60 + saving * 40;

    if (a.income > 0 && a.expense > a.income) score -= 30;
    if (a.income === 0 && a.expense > 0) score -= 40;
    if (a.topCats.length && a.income > 0) {
      const top = a.topCats[0].total;
      if (top / a.income > 0.5) score -= 10;
    }

    score = Math.round(Math.max(0, Math.min(100, score)));
    return score;
  },

  _buildPlan(a) {
    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );

    // sugestões com base nos dados
    const plan = [];

    if (a.income === 0) {
      plan.push(
        "Registre pelo menos uma receita no mês (salário, extra, etc.) para medir seu saldo real.",
      );
      plan.push(
        "Liste todas as despesas fixas (casa, contas, transporte) e marque o que é obrigatório vs. opcional.",
      );
      plan.push(
        "Defina um teto semanal de gastos (ex.: R$ 200/semana) e acompanhe diariamente.",
      );
      return plan;
    }

    const targetSaving = Math.max(0, a.income * 0.15);
    if (a.balance < targetSaving) {
      const gap = targetSaving - Math.max(0, a.balance);
      plan.push(
        `Busque uma taxa de poupança de 15%: tente fechar o mês com pelo menos ${fmt(targetSaving)} de saldo (faltam aprox. ${fmt(gap)}).`,
      );
    } else {
      plan.push(
        `Você já está poupando bem. Mantenha pelo menos ${fmt(targetSaving)} (15%) e considere aumentar gradualmente.`,
      );
    }

    if (a.topCats.length) {
      const top = a.topCats[0];
      const topName = top.cat?.name || "Top categoria";
      const cut = top.total * 0.15;
      plan.push(
        `Reduza ${topName}: tente cortar ~15% (${fmt(cut)}) no próximo mês (ajuste hábitos/limites).`,
      );
    } else {
      plan.push(
        "Categorize suas despesas (Alimentação, Transporte, Casa etc.) para identificar onde dá para otimizar.",
      );
    }

    plan.push(
      "Crie 1 orçamento por categoria essencial (ex.: Alimentação/Transporte) e acompanhe se está perto de estourar (use a aba Orçamentos).",
    );

    return plan.slice(0, 3);
  },

  _buildDebtPlan(profile, a) {
    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );
    const fmtDate = (iso) => {
      if (!iso) return "—";
      const [y, m, d] = String(iso).split("-");
      if (!y || !m || !d) return "—";
      return `${d}/${m}/${y}`;
    };

    const steps = [];

    if (profile.condoOverdue > 0) {
      steps.push(
        `Quite o condomínio em atraso (${fmt(profile.condoOverdue)}) hoje. Isso evita juros, multa e riscos de cobrança.`,
      );
    }

    if (profile.condoUpcoming > 0) {
      steps.push(
        `Separe ${fmt(profile.condoUpcoming)} até ${fmtDate(
          profile.condoUpcomingDue,
        )} para o próximo vencimento do condomínio.`,
      );
    }

    if (profile.debtOverdraft > 0) {
      steps.push(
        `Ataque o cheque especial primeiro (${fmt(
          profile.debtOverdraft,
        )}). É a dívida mais cara. Direcione o máximo possível até zerar.`,
      );
    }

    if (profile.debtCreditCard > 0) {
      steps.push(
        `Após o cheque especial, concentre pagamentos no cartão (${fmt(
          profile.debtCreditCard,
        )}). Evite novas compras parceladas e negocie juros/parcelamento se necessário.`,
      );
    }

    if (profile.debtPaymentTarget > 0) {
      steps.push(
        `Reserve ${fmt(
          profile.debtPaymentTarget,
        )} por mês exclusivamente para dívidas. Trate como conta fixa.`,
      );
    } else if (profile.salary > 0) {
      const suggested = Math.round(profile.salary * 0.3);
      steps.push(
        `Defina uma meta mensal para dívidas. Sugestão inicial: ${fmt(
          suggested,
        )} (cerca de 30% do salário).`,
      );
    }

    if (a?.income > 0) {
      steps.push(
        "Corte ou pause gastos não essenciais e revise assinaturas. Cada ajuste acelera a quitação.",
      );
    }

    return steps.slice(0, 7);
  },

  _buildEasyGoals({ salary, debtPaymentTarget, condoOverdue, condoUpcoming, condoUpcomingDue }) {
    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );
    const fmtDate = (iso) => {
      if (!iso) return "—";
      const [y, m, d] = String(iso).split("-");
      if (!y || !m || !d) return "—";
      return `${d}/${m}/${y}`;
    };

    const weekly = debtPaymentTarget > 0 ? Math.round(debtPaymentTarget / 4) : 0;

    const goals = [];
    if (condoOverdue > 0) {
      goals.push({
        id: "goal-condo-overdue",
        text: `Pagar condomínio em atraso (${fmt(condoOverdue)})`,
      });
    }
    if (condoUpcoming > 0) {
      goals.push({
        id: "goal-condo-upcoming",
        text: `Separar ${fmt(condoUpcoming)} até ${fmtDate(condoUpcomingDue)}`,
      });
    }
    if (weekly > 0) {
      goals.push({
        id: "goal-weekly-debt",
        text: `Guardar ${fmt(weekly)} por semana para dívidas`,
      });
    }
    if (salary > 0) {
      goals.push({
        id: "goal-weekly-limit",
        text: `Definir teto semanal de gastos não essenciais (ex.: ${fmt(
          Math.round(salary * 0.1),
        )})`,
      });
    }
    goals.push({
      id: "goal-review",
      text: "Revisar gastos desnecessários do mês e escolher 1 corte",
    });

    return goals.slice(0, 5);
  },

  _budgetSuggestions(monthKey, mode, catsMap) {
    const cats = catsMap instanceof Map ? catsMap : new Map(catsMap);

    const prevMonthKey = (mk) => {
      const [y, m] = mk.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      d.setMonth(d.getMonth() - 1);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${yy}-${mm}`;
    };

    const sumCatMonth = (mk) => {
      const txm = State.listTransactionsByMonth(mk).filter(
        (t) => t.type === "expense",
      );
      const map = new Map();
      for (const t of txm)
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
      return map;
    };

    const months = mode === "quarterly" ? 3 : 1;
    let key = monthKey;
    const series = [];
    for (let i = 0; i < months; i++) {
      key = prevMonthKey(key);
      series.push(sumCatMonth(key));
    }

    const avgMap = new Map();
    for (const [catId] of cats.entries()) {
      let sum = 0;
      for (const m of series) sum += m.get(catId) || 0;
      const avg = sum / months;
      if (avg > 0) avgMap.set(catId, avg);
    }

    const items = Array.from(avgMap.entries())
      .map(([catId, avg]) => ({
        catId,
        avg,
        suggested: avg * 1.1,
      }))
      .sort((x, y) => y.suggested - x.suggested)
      .slice(0, 5);

    const label =
      mode === "quarterly"
        ? "Base: média trimestral (últimos 3 meses)"
        : "Base: mês anterior";

    return { items, label };
  },

  async _wireGoals() {
    const btnNew = document.getElementById("btnNewGoal");
    const grid = document.getElementById("goalsGrid");

    const goalModal = document.getElementById("goalModal");
    const goalForm = document.getElementById("goalForm");
    const goalTitle = document.getElementById("goalModalTitle");

    const contrModal = document.getElementById("contrModal");
    const contrForm = document.getElementById("contrForm");
    const contrTitle = document.getElementById("contrModalTitle");

    const openGoalCreate = () => {
      goalTitle.textContent = "Nova meta";
      goalForm.reset();
      goalForm.querySelector('input[name="id"]').value = "";
      goalModal.showModal();
    };

    const openGoalEdit = (g) => {
      goalTitle.textContent = "Editar meta";
      goalForm.reset();
      goalForm.querySelector('input[name="id"]').value = g.id;
      goalForm.querySelector('input[name="name"]').value = g.name;
      goalForm.querySelector('input[name="targetAmount"]').value = String(
        g.targetAmount,
      ).replace(".", ",");
      goalForm.querySelector('input[name="deadline"]').value = g.deadline || "";
      goalForm.querySelector('textarea[name="notes"]').value = g.notes || "";
      goalModal.showModal();
    };

    const openContribution = (g) => {
      contrTitle.textContent = `Aporte: ${g.name}`;
      contrForm.reset();
      contrForm.querySelector('input[name="goalId"]').value = g.id;
      contrModal.showModal();
    };

    btnNew?.addEventListener("click", openGoalCreate);

    grid?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      const goals = State.listGoals();
      const g = goals.find((x) => x.id === id);
      if (!g) return;

      if (action === "edit-goal") return openGoalEdit(g);
      if (action === "add-contr") return openContribution(g);

      if (action === "del-goal") {
        const ok = confirm(`Excluir a meta "${g.name}"?`);
        if (!ok) return;
        try {
          await State.deleteGoal(g.id);
          this.toast("Ok", "Meta excluída.");
          this.render("goals");
        } catch (err) {
          this.toast("Erro", err.message || "Falha ao excluir.");
        }
      }
    });

    goalForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(goalForm);
      const id = String(fd.get("id") || "");
      const name = String(fd.get("name") || "").trim();
      const targetAmount = Utils.parseBRLToNumber(
        String(fd.get("targetAmount") || ""),
      );
      const deadline = String(fd.get("deadline") || "").trim() || null;
      const notes = String(fd.get("notes") || "");

      try {
        if (!id) {
          await State.addGoal({ name, targetAmount, deadline, notes });
          this.toast("Salvo", "Meta criada.");
        } else {
          await State.updateGoal(id, { name, targetAmount, deadline, notes });
          this.toast("Salvo", "Meta atualizada.");
        }
        goalModal.close();
        this.render("goals");
      } catch (err) {
        this.toast("Erro", err.message || "Falha ao salvar meta.");
      }
    });

    contrForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(contrForm);
      const goalId = String(fd.get("goalId") || "");
      const amount = Utils.parseBRLToNumber(String(fd.get("amount") || ""));

      try {
        await State.addContribution(goalId, amount);
        this.toast("Ok", "Aporte registrado.");
        contrModal.close();
        this.render("goals");
      } catch (err) {
        this.toast("Erro", err.message || "Falha ao registrar aporte.");
      }
    });

    goalModal?.addEventListener("close", () => goalForm?.reset());
    contrModal?.addEventListener("close", () => contrForm?.reset());
  },

  // ------------------- REPORTS -------------------
  _reports() {
    return `
      <section class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-weight:800">Relatórios</div>
            <div class="muted small">Selecione período e veja totais</div>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <select id="reportPreset" class="btn">
              <option value="this_month">Este mês</option>
              <option value="last_3">Últimos 3 meses</option>
              <option value="last_6">Últimos 6 meses</option>
              <option value="custom">Personalizado</option>
            </select>

            <label class="month-picker" style="padding:6px 10px">
              <span class="muted small">Início</span>
              <input id="reportStart" type="date" />
            </label>

            <label class="month-picker" style="padding:6px 10px">
              <span class="muted small">Fim</span>
              <input id="reportEnd" type="date" />
            </label>

            <button class="btn primary" id="btnRunReport">Gerar</button>
          </div>
        </div>

        <div id="reportOut" style="margin-top:12px"></div>
      </section>
    `;
  },

  async _wireReports() {
    const preset = document.getElementById("reportPreset");
    const startEl = document.getElementById("reportStart");
    const endEl = document.getElementById("reportEnd");
    const btn = document.getElementById("btnRunReport");
    const out = document.getElementById("reportOut");

    const setRange = (start, end) => {
      startEl.value = start;
      endEl.value = end;
    };

    const today = new Date();
    const toISO = (d) =>
      `${d.getFullYear()}-${Utils.pad2(d.getMonth() + 1)}-${Utils.pad2(d.getDate())}`;

    const setPreset = () => {
      const v = preset.value;
      if (v === "this_month") {
        const mk = State.get().settings.monthKey;
        const start = `${mk}-01`;
        const [y, m] = mk.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${mk}-${Utils.pad2(lastDay)}`;
        setRange(start, end);
        startEl.disabled = true;
        endEl.disabled = true;
      } else if (v === "last_3" || v === "last_6") {
        const months = v === "last_3" ? 3 : 6;
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - (months - 1));
        start.setDate(1);
        setRange(toISO(start), toISO(end));
        startEl.disabled = true;
        endEl.disabled = true;
      } else {
        startEl.disabled = false;
        endEl.disabled = false;
      }
    };

    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );

    const run = async () => {
      const start = startEl.value;
      const end = endEl.value;
      if (!start || !end || start > end) {
        out.innerHTML = `<div class="muted">Período inválido.</div>`;
        return;
      }

      // Para simplificar MVP: usamos o cache do mês atual.
      // Para períodos maiores, você pode (depois) buscar transações no Supabase por range.
      // MVP: se range não for do mês atual, avisamos.
      const mk = State.get().settings.monthKey;
      const currentStart = `${mk}-01`;
      const [y, m] = mk.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const currentEnd = `${mk}-${Utils.pad2(lastDay)}`;

      if (start < currentStart || end > currentEnd) {
        out.innerHTML = `<div class="muted">
          MVP: Relatórios completos por vários meses serão ativados na próxima etapa.  
          Por enquanto, gere relatórios dentro do mês selecionado no topo.
        </div>`;
        return;
      }

      let tx = State.listTransactionsInRange(start, end);
      const prefs = State.getConsultorPrefs();
      if (prefs.useProfileOnTransactions) {
        const virtual = this._buildProfileTransactions(
          mk,
          State.getConsultorProfile(),
        );
        const filteredVirtual = virtual.filter(
          (t) => t.date >= start && t.date <= end,
        );
        tx = [...filteredVirtual, ...tx];
      }

      const income = tx
        .filter((t) => t.type === "income")
        .reduce((a, b) => a + b.amount, 0);
      const expense = tx
        .filter((t) => t.type === "expense")
        .reduce((a, b) => a + b.amount, 0);
      const balance = income - expense;

      const cats = new Map(State.listCategories().map((c) => [c.id, c]));
      const byCat = new Map();
      for (const t of tx.filter((t) => t.type === "expense")) {
        byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount);
      }

      const rows = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([catId, val]) => {
          const c = cats.get(catId);
          const name = c ? `${c.icon} ${c.name}` : "—";
          return `<tr><td>${this._escape(name)}</td><td>${fmt(val)}</td></tr>`;
        })
        .join("");

      out.innerHTML = `
        <div class="row">
          <div class="card">
            <div class="muted small">Receitas</div>
            <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(income)}</div>
          </div>
          <div class="card">
            <div class="muted small">Despesas</div>
            <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(expense)}</div>
          </div>
          <div class="card">
            <div class="muted small">Saldo</div>
            <div style="font-size:20px;font-weight:800;margin-top:6px">${fmt(balance)}</div>
          </div>
        </div>

        <div class="card" style="margin-top:12px">
          <div style="font-weight:800">Despesas por categoria</div>
          <div style="margin-top:10px;overflow:auto">
            <table class="table">
              <thead><tr><th>Categoria</th><th>Total</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="2" class="muted">Sem despesas.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      `;
    };

    preset.onchange = setPreset;
    btn.onclick = run;

    // init
    preset.value = "this_month";
    setPreset();
    setRange(`${State.get().settings.monthKey}-01`, toISO(today));
  },

  // ------------------- DASHBOARD -------------------
  _dashboard(monthKey) {
    const s = State.get();
    const tx = this._dashboardTransactions(monthKey);

    const income = tx
      .filter((t) => t.type === "income")
      .reduce((a, b) => a + b.amount, 0);

    const expense = tx
      .filter((t) => t.type === "expense")
      .reduce((a, b) => a + b.amount, 0);

    const balance = income - expense;

    const fmt = (v) =>
      Utils.formatCurrencyBRL(v, s.settings.locale, s.settings.currency);

    const balanceClass =
      balance > 0 ? "kpi--pos" : balance < 0 ? "kpi--neg" : "kpi--zero";

    return `
    <div class="row">
      <div class="kpi kpi--income">
        <div class="kpi__label">Receitas</div>
        <div class="kpi__value">${fmt(income)}</div>
      </div>

      <div class="kpi kpi--expense">
        <div class="kpi__label">Despesas</div>
        <div class="kpi__value">${fmt(expense)}</div>
      </div>

      <div class="kpi ${balanceClass}">
        <div class="kpi__label">Saldo</div>
        <div class="kpi__value">${fmt(balance)}</div>
      </div>
    </div>

    <section class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <div style="font-weight:800">Últimos lançamentos</div>
          <div class="muted small">Mostrando até 5 itens do mês</div>
        </div>
        <span class="badge">${tx.length} no mês</span>
      </div>

      <div style="margin-top:10px; overflow:auto;" class="tx-desktop">
        ${this._txTable(tx.slice(0, 5), { showActions: false })}
      </div>

      <div style="margin-top:10px;" class="tx-mobile">
        ${this._txMobileList(tx.slice(0, 5), { showActions: false })}
      </div>

      ${
        tx.length === 0
          ? `
        <div class="muted" style="margin-top:12px">
          Sem lançamentos neste mês. Clique em <b>+ Novo</b> para adicionar.
        </div>
      `
          : ""
      }
    </section>

          <section class="card" style="margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-weight:800">Visão do mês</div>
            <div class="muted small">Gastos por dia e participação por categoria</div>
          </div>
          <span class="badge">Baseado em lançamentos</span>
        </div>

        <div class="row" style="margin-top:12px">
          <div class="card" style="flex:1;min-width:260px">
            <div style="font-weight:800">Evolução diária (despesas)</div>
            <div class="muted small">últimos 14 dias do mês</div>
            <div id="dashChartBar" style="margin-top:10px"></div>
          </div>

          <div class="card" style="flex:1;min-width:260px">
            <div style="font-weight:800">Top categorias (despesas)</div>
            <div class="muted small">participação no mês</div>
            <div id="dashChartDonut" style="margin-top:10px"></div>
          </div>
        </div>
      </section>

  `;
  },

  _wireDashboard(monthKey) {
    const tx = this._dashboardTransactions(monthKey);
    const cats = State.listCategories();

    const chartBar = document.getElementById("dashChartBar");
    const chartDonut = document.getElementById("dashChartDonut");

    // só despesas
    const exp = tx.filter((t) => t.type === "expense");

    // --- Bar: últimos 14 dias com despesas (soma diária)
    const dayMap = new Map();
    for (const t of exp) {
      dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount);
    }

    const days = Array.from(dayMap.keys()).sort();
    const lastDays = days.slice(-14);

    const labels = lastDays.map((d) => d.slice(8, 10)); // dia do mês
    const values = lastDays.map((d) => dayMap.get(d) || 0);

    if (chartBar) {
      chartBar.innerHTML = Charts.barChartSVG({
        labels,
        values,
        height: 180,
        valueFormatter: (v) =>
          Utils.formatCurrencyBRL(
            v,
            State.get().settings.locale,
            State.get().settings.currency,
          ),
      });
    }

    // --- Donut: top 6 categorias por gasto
    const catMap = new Map();
    for (const t of exp) {
      catMap.set(t.categoryId, (catMap.get(t.categoryId) || 0) + t.amount);
    }

    const top = Array.from(catMap.entries())
      .map(([catId, v]) => {
        const c = cats.find((x) => x.id === catId);
        return { label: c ? `${c.icon} ${c.name}` : "—", value: v };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    if (chartDonut) {
      chartDonut.innerHTML = Charts.donutChartSVG({
        items: top,
        size: 220,
      });
    }
  },

  // ------------------- TRANSACTIONS -------------------
  _transactions(monthKey) {
    const tx = this._transactionsList(monthKey) || [];

    const desktopHtml =
      typeof this._txTable === "function"
        ? this._txTable(tx)
        : `<div class="muted">Tabela não disponível.</div>`;

    const mobileHtml =
      typeof this._txMobileList === "function"
        ? this._txMobileList(tx)
        : `<div class="muted">Lista mobile não disponível.</div>`;

    return `
    <section class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">Lançamentos do mês</div>
          <div class="muted small">Use “+ Novo” para adicionar rapidamente</div>
        </div>
        <span class="badge" id="txCountBadge">${tx.length} itens</span>
      </div>

      <div style="margin-top:10px; overflow:auto;" class="tx-desktop" id="txTableWrap">
        ${desktopHtml}
      </div>

      <div style="margin-top:10px;" class="tx-mobile" id="txMobileWrap">
        ${mobileHtml}
      </div>

      ${tx.length === 0 ? `<div class="muted" id="txEmptyHint" style="margin-top:12px">Sem lançamentos neste mês.</div>` : ""}
    </section>
  `;
  },

  _wireTransactions(monthKey) {
    const container = document.getElementById("appMain");
    if (!container) return;

    const applyMask = (el) => {
      el.addEventListener("input", () => {
        el.value = Utils.moneyMaskBRL(el.value);
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {}
      });
    };

    const qEl = container.querySelector("#txQ");
    const typeEl = container.querySelector("#txType");
    const catEl = container.querySelector("#txCat");
    const payEl = container.querySelector("#txPay");
    const minEl = container.querySelector("#txMin");
    const maxEl = container.querySelector("#txMax");

    const tableWrap = document.getElementById("txTableWrap"); // desktop
    const mobileWrap = document.getElementById("txMobileWrap"); // mobile
    const countBadge = document.getElementById("txCountBadge");
    const emptyHint = document.getElementById("txEmptyHint");
    const hasFilters = !!(qEl || typeEl || catEl || payEl || minEl || maxEl);

    const applyResponsive = () => {
      if (!tableWrap || !mobileWrap) return;
      const mq = window.matchMedia("(max-width: 520px)");
      if (mq.matches) {
        tableWrap.style.setProperty("display", "none", "important");
        mobileWrap.style.setProperty("display", "flex", "important");
        mobileWrap.style.setProperty("flex-direction", "column", "important");
        mobileWrap.style.setProperty("gap", "10px", "important");
      } else {
        tableWrap.style.setProperty("display", "block", "important");
        mobileWrap.style.setProperty("display", "none", "important");
        mobileWrap.style.removeProperty("flex-direction");
        mobileWrap.style.removeProperty("gap");
      }
    };

    // aplica na entrada e acompanha mudanças de tamanho
    applyResponsive();
    try {
      const mq = window.matchMedia("(max-width: 520px)");
      mq.addEventListener?.("change", applyResponsive);
    } catch {}

    if (minEl) applyMask(minEl);
    if (maxEl) applyMask(maxEl);

    const renderFiltered = () => {
      const q = (qEl?.value || "").trim().toLowerCase();
      const type = typeEl?.value || "";
      const cat = catEl?.value || "";
      const pay = payEl?.value || "";
      const min = Utils.parseBRLToNumber(minEl?.value || "") || 0;
      const maxRaw = Utils.parseBRLToNumber(maxEl?.value || "");
      const max = Number.isFinite(maxRaw) ? maxRaw : null;

      let tx = State.listTransactionsByMonth(monthKey);
      const prefs = State.getConsultorPrefs();
      if (prefs.useProfileOnTransactions) {
        tx = this._transactionsList(monthKey);
      }

      if (q)
        tx = tx.filter((t) =>
          String(t.description || "")
            .toLowerCase()
            .includes(q),
        );
      if (type) tx = tx.filter((t) => t.type === type);
      if (cat) tx = tx.filter((t) => t.categoryId === cat);
      if (pay) tx = tx.filter((t) => (t.paymentMethod || "") === pay);
      if (min) tx = tx.filter((t) => t.amount >= min);
      if (max !== null) tx = tx.filter((t) => t.amount <= max);

      if (tableWrap) {
        tableWrap.innerHTML =
          typeof this._txTable === "function"
            ? this._txTable(tx)
            : `<div class="muted">Tabela não disponível.</div>`;
      }

      if (mobileWrap) {
        mobileWrap.innerHTML =
          typeof this._txMobileList === "function"
            ? this._txMobileList(tx)
            : `<div class="muted">Lista mobile não disponível.</div>`;
      }

      if (countBadge) {
        countBadge.textContent = `${tx.length} itens`;
      }

      if (emptyHint) {
        emptyHint.style.display = tx.length === 0 ? "block" : "none";
      }

    };

    if (hasFilters) {
      // filtros
      [qEl, typeEl, catEl, payEl, minEl, maxEl].forEach((el) => {
        if (!el) return;
        el.addEventListener("input", renderFiltered);
        el.addEventListener("change", renderFiltered);
      });
    }

    // ações (editar/excluir) - delegação no container
    container.onclick = async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");

      const list = this._transactionsList(monthKey);
      const tx = list.find((t) => t.id === id);

      if (action === "edit-tx") {
        if (tx?.isVirtual && window.PF?.openPrefillTransaction) {
          await window.PF.openPrefillTransaction({
            type: tx.type,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            categoryId: tx.categoryId,
            paymentMethod: tx.paymentMethod || "pix",
          });
          return;
        }
        if (window.PF?.openEditTransaction) {
          await window.PF.openEditTransaction(id);
        }
        return;
      }

      if (action === "del-tx" || action === "delete-tx") {
        const ok = confirm("Excluir este lançamento?");
        if (!ok) return;

        try {
          if (tx?.isVirtual) {
            const patch = {};
            if (tx.virtualType === "salary") patch.salary = 0;
            if (tx.virtualType === "debtCreditCard") patch.debtCreditCard = 0;
            if (tx.virtualType === "debtOverdraft") patch.debtOverdraft = 0;
            if (tx.virtualType === "condoOverdue") patch.condoOverdue = 0;
            if (tx.virtualType === "condoUpcoming") patch.condoUpcoming = 0;

            State.setConsultorProfile(patch);
            this.toast("Ok", "Lançamento removido.");
          } else {
            await State.deleteTransaction(id);
            this.toast("Ok", "Lançamento excluído.");
          }

          // garante estado atualizado
          await State.fetchTransactionsByMonth(monthKey).catch(() => {});
          this.render("transactions");
        } catch (err) {
          this.toast("Erro", err.message || "Falha ao excluir.");
        }
        return;
      }
    };

    // primeira renderização (somente se houver filtros na tela)
    if (hasFilters) renderFiltered();
  },

  _txTable(items, opts = {}) {
    const showActions = opts.showActions !== false; // default true

    const rows = (items || [])
      .map((t) => {
        const cat = State.listCategories().find((c) => c.id === t.categoryId);
        const catLabel = cat ? `${cat.icon} ${cat.name}` : "—";

        const typeLabel = t.type === "income" ? "Receita" : "Despesa";

        const amount = Utils.formatCurrencyBRL(
          t.amount,
          State.get().settings.locale,
          State.get().settings.currency,
        );

        return `
        <tr>
          <td>${this._escape(t.date)}</td>
          <td>${this._escape(t.description)}</td>
          <td>${this._escape(catLabel)}</td>
          <td>${this._escape(typeLabel)}</td>
          <td>${this._escape(amount)}</td>
          <td>${this._escape(t.paymentMethod || "—")}</td>
          ${
            showActions
              ? `
            <td style="text-align:right">
              <div class="tx-actions">
                <button class="btn tx-btn" type="button" data-action="edit-tx" data-id="${t.id}">
                  <span class="tx-ico">✏️</span><span class="tx-txt">Editar</span>
                </button>
                <button class="btn tx-btn" type="button" data-action="delete-tx" data-id="${t.id}">
                  <span class="tx-ico">✖️</span><span class="tx-txt">Excluir</span>
                </button>
              </div>
            </td>
          `
              : ""
          }
        </tr>
      `;
      })
      .join("");

    return `
    <table class="table" id="txTable" aria-label="Tabela de lançamentos">
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Tipo</th>
          <th>Valor</th>
          <th>Método</th>
          ${showActions ? `<th style="text-align:right">Ações</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="${showActions ? 7 : 6}" class="muted">Sem lançamentos.</td></tr>`}
      </tbody>
    </table>
  `;

    // ===== MOBILE CARDS =====
    const mobile = `
    <div class="tx-mobile" id="txMobileList" aria-label="Lista de lançamentos (mobile)">
      ${items
        .map((t) => {
          const cat = cats.get(t.categoryId);
          const catLabel = cat ? `${cat.icon} ${cat.name}` : "—";
          const typeLabel = t.type === "income" ? "Receita" : "Despesa";

          return `
          <div class="tx-item">
            <div class="tx-top">
              <div class="tx-desc">${this._escape(t.description)}</div>
              <div class="tx-amount">${fmt(t.amount)}</div>
            </div>

            <div class="tx-meta">
              <span class="tx-pill">📅 ${t.date}</span>
              <span class="tx-pill">🏷️ ${this._escape(catLabel)}</span>
              <span class="tx-pill">${typeLabel === "Receita" ? "🟢" : "🔴"} ${typeLabel}</span>
              <span class="tx-pill">💳 ${this._escape(t.paymentMethod)}</span>
            </div>

            <div class="tx-actions-mobile">
              <button class="btn tx-btn" data-action="edit-tx" data-id="${t.id}" type="button" aria-label="Editar">
                <span class="tx-ico">✏️</span><span class="tx-txt">Editar</span>
              </button>
              <button class="btn tx-btn" data-action="del-tx" data-id="${t.id}" type="button" aria-label="Excluir">
                <span class="tx-ico">✖️</span><span class="tx-txt">Excluir</span>
              </button>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;

    return table + mobile;
  },

  _txMobileList(items, opts = {}) {
    const showActions = opts.showActions !== false; // default true
    const cats = new Map(State.listCategories().map((c) => [c.id, c]));

    const fmt = (v) =>
      Utils.formatCurrencyBRL(
        v,
        State.get().settings.locale,
        State.get().settings.currency,
      );

    return (
      (items || [])
        .map((t) => {
          const cat = cats.get(t.categoryId);
          const catLabel = cat ? `${cat.icon} ${cat.name}` : "—";
          const typeLabel = t.type === "income" ? "Receita" : "Despesa";
          return `
      <div class="txm-item">
        <div class="txm-top">
          <div style="min-width:0">
            <div class="txm-title">${this._escape(t.description || "")}</div>
            <div class="txm-sub">
              <span>${this._escape(t.date || "")}</span>
              <span>${this._escape(catLabel)}</span>
              <span>${this._escape(typeLabel)}</span>
              <span>${this._escape(t.paymentMethod || "—")}</span>
            </div>
          </div>

          <div class="txm-amount">${fmt(t.amount || 0)}</div>
        </div>

        ${
          showActions
            ? `
        <div class="txm-actions">
          <button class="btn tx-btn" type="button" data-action="edit-tx" data-id="${t.id}">
            <span class="tx-ico">✏️</span><span class="tx-txt">Editar</span>
          </button>
          <button class="btn tx-btn" type="button" data-action="delete-tx" data-id="${t.id}">
            <span class="tx-ico">✖️</span><span class="tx-txt">Excluir</span>
          </button>
        </div>
      `
            : ""
        }
      </div>
    `;
        })
        .join("") || `<div class="muted">Sem lançamentos.</div>`
    );
  },

  // ------------------- CATEGORIES (CRUD) -------------------
  _categories() {
    const cats = State.listCategories();

    return `
      <section class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-weight:800">Categorias</div>
            <div class="muted small">Crie, edite e exclua categorias</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="badge">${cats.length} categorias</span>
            <button class="btn primary" id="btnNewCategory">+ Nova categoria</button>
          </div>
        </div>

        <div style="margin-top:12px" class="grid" id="categoryGrid">
          ${cats
            .map(
              (c) => `
            <div class="card" style="padding:12px;border-radius:14px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                <div style="display:flex;gap:10px;align-items:center;min-width:0">
                  <div style="width:36px;height:36px;border-radius:12px;background:${c.color};display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.15)">
                    <span aria-hidden="true">${c.icon}</span>
                  </div>
                  <div style="min-width:0">
                    <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this._escape(c.name)}</div>
                    <div class="muted small">Tipo: ${this._escape(c.kind)}</div>
                  </div>
                </div>

                <div style="display:flex;gap:8px;align-items:center">
                  <button class="btn" data-action="edit-category" data-id="${c.id}">Editar</button>
                  <button class="btn" data-action="delete-category" data-id="${c.id}">Excluir</button>
                </div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
    `;
  },

  _wireCategories() {
    const btnNew = document.getElementById("btnNewCategory");
    const grid = document.getElementById("categoryGrid");

    const modal = document.getElementById("categoryModal");
    const form = document.getElementById("categoryForm");
    const title = document.getElementById("categoryModalTitle");

    const openForCreate = () => {
      title.textContent = "Nova categoria";
      form.reset();
      form.querySelector('input[name="id"]').value = "";
      form.querySelector('input[name="color"]').value = "#6d5efc";
      modal.showModal();
    };

    const openForEdit = (cat) => {
      title.textContent = "Editar categoria";
      form.reset();
      form.querySelector('input[name="id"]').value = cat.id;
      form.querySelector('input[name="name"]').value = cat.name;
      form.querySelector('select[name="kind"]').value = cat.kind;
      form.querySelector('input[name="icon"]').value = cat.icon;
      form.querySelector('input[name="color"]').value = cat.color;
      modal.showModal();
    };

    // Emoji picker (preenche o input)
    const iconInput = document.getElementById("catIconInput");
    const picker = document.getElementById("catEmojiPicker");

    picker?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-emoji]");
      if (!b) return;
      const emo = b.getAttribute("data-emoji");
      if (!emo) return;
      if (iconInput) iconInput.value = emo;
    });

    if (btnNew) btnNew.onclick = openForCreate;

    if (grid) {
      grid.onclick = async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const cat = State.listCategories().find((c) => c.id === id);
        if (!cat) return;

        if (action === "edit-category") {
          openForEdit(cat);
          return;
        }

        if (action === "delete-category") {
          try {
            const inUse = await State.isCategoryInUse(cat.id);
            if (inUse) {
              this.toast(
                "Não permitido",
                "Essa categoria está em uso em lançamentos.",
              );
              return;
            }

            const ok = confirm(`Excluir a categoria "${cat.name}"?`);
            if (!ok) return;

            await State.deleteCategory(cat.id);
            this.toast("Excluída", "Categoria removida.");
            this.render("categories");
          } catch (err) {
            this.toast("Erro", err?.message || "Falha ao excluir.");
          }
        }
      };
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();

        const fd = new FormData(form);
        const id = String(fd.get("id") || "");
        const name = String(fd.get("name") || "").trim();
        const kind = String(fd.get("kind") || "expense");
        const icon = String(fd.get("icon") || "🏷️").trim() || "🏷️";
        const color = String(fd.get("color") || "#6d5efc");

        try {
          if (!id) {
            await State.addCategory({ name, kind, icon, color });
            this.toast("Salvo", "Categoria criada.");
          } else {
            await State.updateCategory(id, { name, kind, icon, color });
            this.toast("Salvo", "Categoria atualizada.");
          }

          modal.close();
          this.render("categories");
        } catch (err) {
          this.toast("Erro", err?.message || "Verifique os campos.");
        }
      };
    }

    modal?.addEventListener("close", () => form?.reset());
  },

  // ------------------- SETTINGS -------------------
  _settings() {
    const s = State.get().settings;
    return `
      <section class="card">
        <div style="font-weight:800">Preferências</div>
        <div class="muted small">Tema e dados locais</div>

        <div class="grid" style="margin-top:12px">
          <label class="field">
            <span>Tema</span>
            <select id="themeSelect">
              <option value="dark" ${s.theme === "dark" ? "selected" : ""}>Escuro</option>
              <option value="light" ${s.theme === "light" ? "selected" : ""}>Claro (em breve)</option>
            </select>
          </label>

          <div class="field">
            <span>Armazenamento</span>
            <div class="muted">localStorage (vamos migrar para Supabase)</div>
          </div>

          <div class="field span-2">
            <button class="btn" id="btnReset">Resetar dados</button>
            <div class="muted small" style="margin-top:6px">Isso apaga tudo do navegador.</div>
          </div>
        </div>
      </section>
    `;
  },

  _wireSettings() {
    const themeSelect = document.getElementById("themeSelect");
    const btnReset = document.getElementById("btnReset");

    if (themeSelect) {
      themeSelect.onchange = () => {
        const s = State.get();
        s.settings.theme = themeSelect.value;
        State.save();
        this.toast("Tema", "Tema salvo. (Light completo será na fase final)");
      };
    }

    if (btnReset) {
      btnReset.onclick = () => {
        const ok = confirm("Tem certeza? Isso apaga TODOS os dados salvos.");
        if (!ok) return;
        localStorage.clear();
        State.load();
        this.toast("Dados", "Dados resetados.");
        location.hash = "#/dashboard";
        this.render("dashboard");
      };
    }
  },

  // ------------------- LOGIN -------------------
  _login() {
    return `
      <section class="card" style="max-width:520px;margin:0 auto;">
        <div style="font-weight:800;font-size:18px">Entrar</div>
        <div class="muted small" style="margin-top:4px">Use email e senha (Supabase Auth)</div>

        <div class="grid" style="margin-top:14px">
          <label class="field span-2">
            <span>Email</span>
            <input type="email" id="loginEmail" placeholder="seuemail@dominio.com" required />
          </label>

          <label class="field span-2">
            <span>Senha</span>
            <input type="password" id="loginPassword" placeholder="••••••••" required />
          </label>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
          <button class="btn" id="btnSignUp" type="button">Criar conta</button>
          <button class="btn primary" id="btnSignIn" type="button">Entrar</button>
        </div>

        <div class="muted small" style="margin-top:10px">
          Se sua conta exigir confirmação por email, verifique sua caixa de entrada.
        </div>
      </section>
    `;
  },

  async _wireLogin() {
    const { Auth } = await import("./auth.js");

    const emailEl = document.getElementById("loginEmail");
    const passEl = document.getElementById("loginPassword");
    const btnIn = document.getElementById("btnSignIn");
    const btnUp = document.getElementById("btnSignUp");

    const getCreds = () => {
      const email = String(emailEl?.value || "").trim();
      const password = String(passEl?.value || "");
      return { email, password };
    };

    if (btnIn) {
      btnIn.onclick = async () => {
        const { email, password } = getCreds();
        if (!email || !password)
          return this.toast("Erro", "Informe email e senha.");

        try {
          await Auth.signIn(email, password);
          this.toast("Ok", "Login realizado.");
          location.hash = "#/dashboard";
        } catch (e) {
          this.toast("Erro", e.message || "Falha no login.");
        }
      };
    }

    if (btnUp) {
      btnUp.onclick = async () => {
        const { email, password } = getCreds();
        if (!email || !password)
          return this.toast("Erro", "Informe email e senha.");

        try {
          await Auth.signUp(email, password);
          this.toast(
            "Conta criada",
            "Se necessário, confirme o email para ativar.",
          );
        } catch (e) {
          this.toast("Erro", e.message || "Falha ao criar conta.");
        }
      };
    }
  },

  // ------------------- HELPERS -------------------
  _placeholder(title, msg) {
    return `
      <section class="card">
        <div style="font-weight:800">${this._escape(title)}</div>
        <div class="muted" style="margin-top:8px">${this._escape(msg)}</div>
      </section>
    `;
  },

  _escape(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },
};
