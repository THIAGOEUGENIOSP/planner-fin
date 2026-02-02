export const Utils = {
  pad2(n) {
    return String(n).padStart(2, "0");
  },

  monthKeyFromDate(dateStr) {
    // dateStr: YYYY-MM-DD
    if (!dateStr || typeof dateStr !== "string") return null;
    return dateStr.slice(0, 7);
  },

  todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = this.pad2(d.getMonth() + 1);
    const day = this.pad2(d.getDate());
    return `${y}-${m}-${day}`;
  },

  currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}`;
  },

  parseBRLToNumber(input) {
    // aceita "1.234,56" ou "1234,56" ou "1234.56"
    if (typeof input !== "string") return NaN;
    const clean = input
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? n : NaN;
  },

  formatCurrencyBRL(value, locale = "pt-BR", currency = "BRL") {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(v);
  },

  moneyMaskBRL(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    const cents = Number(digits) / 100;
    return cents.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  formatNumberBRL(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  uuid() {
    // simples e suficiente pro projeto (não criptográfico)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};
