import { Utils } from "./utils.js";
import { supabase } from "./supabaseClient.js";

const LOCAL_KEY = "plannerfin_state_v1_local";

function buildLocalState() {
  return {
    version: 1,
    settings: {
      currency: "BRL",
      locale: "pt-BR",
      theme: "dark",
      startRoute: "#/dashboard",
      monthKey: Utils.currentMonthKey(),
    },
    uiPrefs: {
      hiddenBudgetRows: {},
    },
    consultorProfile: {
      salary: 3100,
      debtCreditCard: 7000,
      debtOverdraft: 2000,
      condoOverdue: 700,
      condoUpcoming: 700,
      condoUpcomingDue: "2026-02-15",
    },
    consultorPrefs: {
      essentialCategoryIds: [],
      debtPaymentTarget: 0,
      useProfileOnDashboard: true,
      useProfileOnTransactions: true,
      easyGoalsStatus: {},
      budgetSuggestionMode: "monthly",
    },
  };
}

let _local = null;
let _session = null;

// cache em memória (sempre fonte = Supabase quando logado)
let _categories = [];
let _transactions = [];
let _budgets = []; // budgets do mês atual
let _goals = [];

export const State = {
  // ----------- sessão ----------
  setSession(session) {
    _session = session || null;
  },

  isLogged() {
    return !!_session?.user?.id;
  },

  userId() {
    return _session?.user?.id || null;
  },

  save() {
    // ✅ se seu state já tem outro método de persistência, use ele aqui
    if (typeof this.persist === "function") return this.persist();
    if (typeof this._save === "function") return this._save();
    if (typeof this.saveState === "function") return this.saveState();

    // fallback: salva tudo no localStorage
    try {
      localStorage.setItem("planner_fin_state", JSON.stringify(this.get()));
    } catch {}
  },

  // ----------- settings local ----------
  load() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      _local = raw ? JSON.parse(raw) : buildLocalState();
    } catch {
      _local = buildLocalState();
    }

    // Migração/garantia de campos locais
    if (!_local.uiPrefs) _local.uiPrefs = { hiddenBudgetRows: {} };
    if (!_local.uiPrefs.hiddenBudgetRows) _local.uiPrefs.hiddenBudgetRows = {};
    if (!_local.consultorProfile) {
      _local.consultorProfile = buildLocalState().consultorProfile;
    }
    if (!_local.consultorPrefs) {
      _local.consultorPrefs = buildLocalState().consultorPrefs;
    }
    if (!_local.consultorPrefs.essentialCategoryIds) {
      _local.consultorPrefs.essentialCategoryIds = [];
    }
    if (_local.consultorPrefs.debtPaymentTarget == null) {
      _local.consultorPrefs.debtPaymentTarget = 0;
    }
    if (_local.consultorPrefs.useProfileOnDashboard == null) {
      _local.consultorPrefs.useProfileOnDashboard = true;
    }
    if (_local.consultorPrefs.useProfileOnTransactions == null) {
      _local.consultorPrefs.useProfileOnTransactions = true;
    }
    if (!_local.consultorPrefs.easyGoalsStatus) {
      _local.consultorPrefs.easyGoalsStatus = {};
    }
    if (!_local.consultorPrefs.budgetSuggestionMode) {
      _local.consultorPrefs.budgetSuggestionMode = "monthly";
    }

    this.saveLocal();
    return _local;
  },

  get() {
    if (!_local) return this.load();
    return _local;
  },

  saveLocal() {
    if (!_local) return;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(_local));
  },

  getConsultorProfile() {
    const s = this.get();
    if (!s.consultorProfile) {
      s.consultorProfile = buildLocalState().consultorProfile;
      this.saveLocal();
    }
    return { ...s.consultorProfile };
  },

  setConsultorProfile(patch) {
    const s = this.get();
    const base = s.consultorProfile || buildLocalState().consultorProfile;
    s.consultorProfile = { ...base, ...(patch || {}) };
    this.saveLocal();
    return { ...s.consultorProfile };
  },

  getConsultorPrefs() {
    const s = this.get();
    if (!s.consultorPrefs) {
      s.consultorPrefs = buildLocalState().consultorPrefs;
      this.saveLocal();
    }
    return { ...s.consultorPrefs };
  },

  setConsultorPrefs(patch) {
    const s = this.get();
    const base = s.consultorPrefs || buildLocalState().consultorPrefs;
    s.consultorPrefs = { ...base, ...(patch || {}) };
    this.saveLocal();
    return { ...s.consultorPrefs };
  },

  setMonthKey(monthKey) {
    const s = this.get();
    s.settings.monthKey = monthKey;
    this.saveLocal();
  },

  // ----------- Sync inicial ----------
  async syncAllForMonth(monthKey) {
    const keepUiPrefs = this.get().uiPrefs || {};

    if (!this.isLogged()) return;

    const results = await Promise.allSettled([
      this.fetchCategories(),
      this.fetchTransactionsByMonth(monthKey),
      this.fetchBudgetsByMonth(monthKey),
      this.fetchGoals(),
    ]);

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason);
    if (errors.length) {
      // Evita bloquear o resto da UI quando algum fetch falha
      console.warn("syncAllForMonth: falhas no carregamento", errors);
    }

    // ✅ preserva uiPrefs mesmo depois da sincronização
    this.get().uiPrefs = keepUiPrefs;

    this.save(); // ou persist(), mas precisa existir
  },
  // ----------- Categories (Supabase) ----------
  listCategories() {
    return _categories.slice();
  },

  async fetchCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,kind,color,icon,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    _categories = data || [];

    // ✅ SEED: se o usuário ainda não tem categorias no Supabase, cria um conjunto padrão
    if (_categories.length === 0) {
      const defaults = [
        { name: "Salário", kind: "income", color: "#22c55e", icon: "💼" },
        { name: "Outros ganhos", kind: "income", color: "#16a34a", icon: "➕" },

        { name: "Alimentação", kind: "expense", color: "#ef4444", icon: "🍔" },
        { name: "Transporte", kind: "expense", color: "#3b82f6", icon: "🚗" },
        { name: "Casa", kind: "expense", color: "#a855f7", icon: "🏠" },
        { name: "Saúde", kind: "expense", color: "#f97316", icon: "🩺" },
        { name: "Lazer", kind: "expense", color: "#eab308", icon: "🎮" },
        { name: "Outros", kind: "both", color: "#6b7280", icon: "🏷️" },
      ];

      const { data: inserted, error: insErr } = await supabase
        .from("categories")
        .insert(defaults.map((d) => ({ user_id: this.userId(), ...d })))
        .select("id,name,kind,color,icon,created_at,updated_at");

      if (insErr) throw insErr;

      _categories = inserted || [];
    }

    return _categories;
  },

  async addCategory(payload) {
    const name = String(payload.name || "").trim();
    const kind = payload.kind || "expense";
    const color = payload.color || "#6d5efc";
    const icon = String(payload.icon || "🏷️").trim();

    if (!name) throw new Error("Nome é obrigatório.");

    const { data, error } = await supabase
      .from("categories")
      .insert([{ user_id: this.userId(), name, kind, color, icon }])
      .select("id,name,kind,color,icon,created_at,updated_at")
      .single();

    if (error) throw error;
    _categories.unshift(data);
    return data;
  },

  async updateCategory(id, payload) {
    const name = String(payload.name || "").trim();
    const kind = payload.kind;
    const color = payload.color;
    const icon = String(payload.icon || "").trim();

    if (!name) throw new Error("Nome é obrigatório.");

    const update = { name };
    if (kind) update.kind = kind;
    if (color) update.color = color;
    if (icon) update.icon = icon;

    const { data, error } = await supabase
      .from("categories")
      .update(update)
      .eq("id", id)
      .select("id,name,kind,color,icon,created_at,updated_at")
      .single();

    if (error) throw error;

    const idx = _categories.findIndex((c) => c.id === id);
    if (idx !== -1) _categories[idx] = data;

    return data;
  },

  async isCategoryInUse(categoryId) {
    const { count, error } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);

    if (error) throw error;
    return (count || 0) > 0;
  },

  async deleteCategory(categoryId) {
    // bloqueia se em uso
    if (await this.isCategoryInUse(categoryId)) {
      throw new Error(
        "Não é possível excluir: categoria está em uso em lançamentos.",
      );
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);
    if (error) throw error;

    _categories = _categories.filter((c) => c.id !== categoryId);
  },

  // ----------- Transactions (Supabase) ----------
  listTransactionsByMonth(monthKey) {
    return _transactions.filter(
      (t) => Utils.monthKeyFromDate(t.date) === monthKey,
    );
  },

  listTransactionsInRange(startISO, endISO) {
    // endISO inclusivo
    return _transactions.filter((t) => t.date >= startISO && t.date <= endISO);
  },

  async fetchTransactionsByMonth(monthKey) {
    const start = `${monthKey}-01`;
    const [y, m] = monthKey.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // mês m (1..12)
    const end = `${monthKey}-${Utils.pad2(lastDay)}`;

    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id,type,date,amount,category_id,description,payment_method,notes,tags,is_recurring,recurrence,created_at,updated_at",
      )
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (error) throw error;

    // normaliza category_id -> categoryId (pra manter seu UI atual)
    _transactions = (data || []).map((d) => ({
      id: d.id,
      type: d.type,
      date: d.date,
      amount: Number(d.amount),
      categoryId: d.category_id,
      description: d.description,
      paymentMethod: d.payment_method,
      notes: d.notes,
      tags: d.tags || [],
      isRecurring: d.is_recurring,
      recurrence: d.recurrence,
      createdAt: d.created_at,
    }));

    return _transactions;
  },

  async addTransaction(payload) {
    const type = payload.type;
    const date = payload.date;
    const amount = payload.amount;
    const categoryId = payload.categoryId;
    const description = String(payload.description || "").trim();
    const paymentMethod = payload.paymentMethod || "pix";

    if (
      !date ||
      !description ||
      !categoryId ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error("Dados inválidos.");
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert([
        {
          user_id: this.userId(),
          type,
          date,
          amount,
          category_id: categoryId,
          description,
          payment_method: paymentMethod,
        },
      ])
      .select(
        "id,type,date,amount,category_id,description,payment_method,notes,tags,is_recurring,recurrence,created_at,updated_at",
      )
      .single();

    if (error) throw error;

    const tx = {
      id: data.id,
      type: data.type,
      date: data.date,
      amount: Number(data.amount),
      categoryId: data.category_id,
      description: data.description,
      paymentMethod: data.payment_method,
      notes: data.notes || "",
      tags: data.tags || [],
      isRecurring: data.is_recurring,
      recurrence: data.recurrence,
      createdAt: data.created_at,
    };

    _transactions.unshift(tx);
    return tx;
  },

  async updateTransaction(id, payload) {
    const type = payload.type;
    const date = payload.date;
    const amount = payload.amount;
    const categoryId = payload.categoryId;
    const description = String(payload.description || "").trim();
    const paymentMethod = payload.paymentMethod || "pix";

    if (!id) throw new Error("ID inválido.");
    if (
      !date ||
      !description ||
      !categoryId ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error("Dados inválidos.");
    }

    const { data, error } = await supabase
      .from("transactions")
      .update({
        type,
        date,
        amount,
        category_id: categoryId,
        description,
        payment_method: paymentMethod,
      })
      .eq("id", id)
      .select(
        "id,type,date,amount,category_id,description,payment_method,notes,tags,is_recurring,recurrence,created_at,updated_at",
      )
      .single();

    if (error) throw error;

    const tx = {
      id: data.id,
      type: data.type,
      date: data.date,
      amount: Number(data.amount),
      categoryId: data.category_id,
      description: data.description,
      paymentMethod: data.payment_method,
      notes: data.notes || "",
      tags: data.tags || [],
      isRecurring: data.is_recurring,
      recurrence: data.recurrence,
      createdAt: data.created_at,
    };

    const idx = _transactions.findIndex((t) => t.id === id);
    if (idx !== -1) _transactions[idx] = tx;

    return tx;
  },

  async deleteTransaction(id) {
    if (!id) throw new Error("ID inválido.");

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) throw error;

    _transactions = _transactions.filter((t) => t.id !== id);
  },

  async deleteBudget(monthKey, categoryId) {
    // remove do cache/local imediatamente
    const s = this.get();
    if (!s.budgets) s.budgets = {};
    if (!s.budgets[monthKey]) s.budgets[monthKey] = {};

    delete s.budgets[monthKey][categoryId];
    this.save();

    // remove no Supabase (se logado)
    const session = s.session;
    if (!session) return true;

    const { supabase } = await import("./supabaseClient.js");

    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("month_key", monthKey)
      .eq("category_id", categoryId)
      .eq("user_id", session.user.id);

    if (error) throw error;

    return true;
  },

  // ----------- Budgets (Supabase) ----------
  // =========================
  // Budgets UI prefs (hide rows)
  // =========================
  _ensureBudgetHiddenStore() {
    const s = this.get();
    if (!s.uiPrefs) s.uiPrefs = {};
    if (!s.uiPrefs.hiddenBudgetRows) s.uiPrefs.hiddenBudgetRows = {}; // { [monthKey]: [catId,...] }
    return s.uiPrefs.hiddenBudgetRows;
  },

  // Aceita (monthKey, catId) OU (catId, monthKey) pra não quebrar o UI
  isBudgetRowHidden(a, b) {
    let monthKey, catId;

    // monthKey normalmente é "YYYY-MM"
    if (typeof a === "string" && /^\d{4}-\d{2}$/.test(a)) {
      monthKey = a;
      catId = b;
    } else if (typeof b === "string" && /^\d{4}-\d{2}$/.test(b)) {
      monthKey = b;
      catId = a;
    } else {
      // fallback: não esconde nada
      return false;
    }

    const store = this._ensureBudgetHiddenStore();
    const arr = store[monthKey] || [];
    return arr.includes(catId);
  },

  hideBudgetRow(monthKey, catId) {
    const store = this._ensureBudgetHiddenStore();
    const arr = new Set(store[monthKey] || []);
    arr.add(catId);
    store[monthKey] = Array.from(arr);
    this.save();
  },

  unhideBudgetRow(monthKey, catId) {
    const store = this._ensureBudgetHiddenStore();
    const arr = new Set(store[monthKey] || []);
    arr.delete(catId);
    store[monthKey] = Array.from(arr);
    this.save();
  },

  clearHiddenBudgetRows(monthKey) {
    const store = this._ensureBudgetHiddenStore();
    store[monthKey] = [];
    this.save();
  },

  budgetsForMonth(monthKey) {
    // retorna map categoryId -> amount
    const map = new Map();
    _budgets
      .filter((b) => b.month_key === monthKey)
      .forEach((b) => map.set(b.category_id, Number(b.amount)));
    return map;
  },

  async fetchBudgetsByMonth(monthKey) {
    const { data, error } = await supabase
      .from("budgets")
      .select("id,month_key,category_id,amount,created_at,updated_at")
      .eq("month_key", monthKey);

    if (error) throw error;
    _budgets = data || [];
    return _budgets;
  },

  async upsertBudget(monthKey, categoryId, amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0)
      throw new Error("Orçamento inválido.");

    const { data, error } = await supabase
      .from("budgets")
      .upsert(
        [
          {
            user_id: this.userId(),
            month_key: monthKey,
            category_id: categoryId,
            amount: value,
          },
        ],
        { onConflict: "user_id,month_key,category_id" },
      )
      .select("id,month_key,category_id,amount,created_at,updated_at")
      .single();

    if (error) throw error;

    const idx = _budgets.findIndex(
      (b) => b.month_key === monthKey && b.category_id === categoryId,
    );
    if (idx === -1) _budgets.push(data);
    else _budgets[idx] = data;

    return data;
  },
  async deleteBudget(monthKey, categoryId) {
    if (!monthKey || !categoryId) throw new Error("Parâmetros inválidos.");
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("month_key", monthKey)
      .eq("category_id", categoryId)
      .eq("user_id", this.userId());

    // Se não existir linha, Supabase não dá erro — ok.
    if (error) throw error;

    _budgets = _budgets.filter(
      (b) => !(b.month_key === monthKey && b.category_id === categoryId),
    );
  },

  // ----------- UI Prefs locais (não vão para o Supabase) ----------
  _ensureUiPrefs() {
    const s = this.get();
    if (!s.uiPrefs) s.uiPrefs = {};
    if (!s.uiPrefs.hiddenBudgetRows) s.uiPrefs.hiddenBudgetRows = {};
    return s.uiPrefs;
  },

  isBudgetRowHidden(monthKey, categoryId) {
    const prefs = this._ensureUiPrefs();
    const arr = prefs.hiddenBudgetRows[monthKey] || [];
    return arr.includes(categoryId);
  },

  hideBudgetRow(monthKey, categoryId) {
    const prefs = this._ensureUiPrefs();
    const arr = prefs.hiddenBudgetRows[monthKey] || [];
    if (!arr.includes(categoryId)) arr.push(categoryId);
    prefs.hiddenBudgetRows[monthKey] = arr;
    this.saveLocal();
  },

  unhideAllBudgetRows(monthKey) {
    const prefs = this._ensureUiPrefs();
    prefs.hiddenBudgetRows[monthKey] = [];
    this.saveLocal();
  },

  // ----------- Goals (Supabase) ----------
  listGoals() {
    return _goals.slice();
  },

  async fetchGoals() {
    const { data, error } = await supabase
      .from("goals")
      .select(
        "id,name,target_amount,current_amount,deadline,notes,created_at,updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    _goals = (data || []).map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.target_amount),
      currentAmount: Number(g.current_amount),
      deadline: g.deadline,
      notes: g.notes || "",
      createdAt: g.created_at,
    }));

    return _goals;
  },

  async addGoal(payload) {
    const name = String(payload.name || "").trim();
    const targetAmount = Number(payload.targetAmount);
    const deadline = payload.deadline || null;
    const notes = String(payload.notes || "");

    if (!name) throw new Error("Nome é obrigatório.");
    if (!Number.isFinite(targetAmount) || targetAmount <= 0)
      throw new Error("Valor alvo inválido.");

    const { data, error } = await supabase
      .from("goals")
      .insert([
        {
          user_id: this.userId(),
          name,
          target_amount: targetAmount,
          current_amount: 0,
          deadline,
          notes,
        },
      ])
      .select(
        "id,name,target_amount,current_amount,deadline,notes,created_at,updated_at",
      )
      .single();

    if (error) throw error;

    const goal = {
      id: data.id,
      name: data.name,
      targetAmount: Number(data.target_amount),
      currentAmount: Number(data.current_amount),
      deadline: data.deadline,
      notes: data.notes || "",
      createdAt: data.created_at,
    };

    _goals.unshift(goal);
    return goal;
  },

  async updateGoal(id, payload) {
    const update = {};
    if (payload.name != null) update.name = String(payload.name).trim();
    if (payload.targetAmount != null)
      update.target_amount = Number(payload.targetAmount);
    if (payload.deadline !== undefined)
      update.deadline = payload.deadline || null;
    if (payload.notes !== undefined) update.notes = String(payload.notes || "");

    if (update.name === "") throw new Error("Nome é obrigatório.");
    if (
      update.target_amount != null &&
      (!Number.isFinite(update.target_amount) || update.target_amount <= 0)
    ) {
      throw new Error("Valor alvo inválido.");
    }

    const { data, error } = await supabase
      .from("goals")
      .update(update)
      .eq("id", id)
      .select(
        "id,name,target_amount,current_amount,deadline,notes,created_at,updated_at",
      )
      .single();

    if (error) throw error;

    const idx = _goals.findIndex((g) => g.id === id);
    if (idx !== -1) {
      _goals[idx] = {
        id: data.id,
        name: data.name,
        targetAmount: Number(data.target_amount),
        currentAmount: Number(data.current_amount),
        deadline: data.deadline,
        notes: data.notes || "",
        createdAt: data.created_at,
      };
    }

    return _goals[idx];
  },

  async deleteGoal(id) {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
    _goals = _goals.filter((g) => g.id !== id);
  },

  async addContribution(goalId, value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) throw new Error("Aporte inválido.");

    const goal = _goals.find((g) => g.id === goalId);
    if (!goal) throw new Error("Meta não encontrada.");

    const newAmount = goal.currentAmount + v;

    const { data, error } = await supabase
      .from("goals")
      .update({ current_amount: newAmount })
      .eq("id", goalId)
      .select(
        "id,name,target_amount,current_amount,deadline,notes,created_at,updated_at",
      )
      .single();

    if (error) throw error;

    const idx = _goals.findIndex((g) => g.id === goalId);
    _goals[idx] = {
      id: data.id,
      name: data.name,
      targetAmount: Number(data.target_amount),
      currentAmount: Number(data.current_amount),
      deadline: data.deadline,
      notes: data.notes || "",
      createdAt: data.created_at,
    };

    return _goals[idx];
  },

  analyzeMonth(monthKey) {
    const tx = this.listTransactionsByMonth(monthKey);
    const incomeTx = tx.filter((t) => t.type === "income");
    const expenseTx = tx.filter((t) => t.type === "expense");

    const income = incomeTx.reduce((a, b) => a + b.amount, 0);
    const expense = expenseTx.reduce((a, b) => a + b.amount, 0);
    const balance = income - expense;

    const savingRate = income > 0 ? balance / income : 0;

    const cats = new Map(this.listCategories().map((c) => [c.id, c]));
    const byCat = new Map();
    for (const t of expenseTx) {
      byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount);
    }

    const topCats = [...byCat.entries()]
      .map(([catId, total]) => ({ catId, total, cat: cats.get(catId) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // alertas simples
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
};
// ----------- Fim do State ----------
