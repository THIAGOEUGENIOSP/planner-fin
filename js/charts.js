// charts.js
// Gráficos SVG (zero dependências). Leve, rápido e seguro.
// Mantém init/destroyAll para não quebrar nada existente.
export const Charts = {
  init() {},
  destroyAll() {},

  /**
   * Bar chart SVG
   * @param {Object} params
   * @param {string[]} params.labels
   * @param {number[]} params.values
   * @param {number} params.height
   * @param {number} params.width
   * @param {(value:number)=>string} params.valueFormatter
   */
  barChartSVG({
    labels = [],
    values = [],
    height = 180,
    width = 520,
    valueFormatter,
  } = {}) {
    const n = Math.min(labels.length, values.length);
    if (!n) return `<div class="muted small">Sem dados para o gráfico.</div>`;

    const pad = { top: 10, right: 10, bottom: 26, left: 10 };
    const w = Math.max(280, Number(width) || 520);
    const h = Math.max(140, Number(height) || 180);
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    const vals = values.slice(0, n).map((v) => Math.max(0, Number(v) || 0));
    const maxV = Math.max(...vals, 0);
    const safeMax = maxV > 0 ? maxV : 1;

    const gap = 6;
    const barW = Math.max(10, Math.floor((innerW - gap * (n - 1)) / n));

    const baseY = pad.top + innerH;
    const format =
      typeof valueFormatter === "function"
        ? valueFormatter
        : (v) => String(v ?? "");

    const bars = [];
    const xLabels = [];

    for (let i = 0; i < n; i++) {
      const v = vals[i];
      const barH = Math.round((v / safeMax) * innerH);
      const x = pad.left + i * (barW + gap);
      const y = pad.top + (innerH - barH);

      // barra
      bars.push(
        `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" ry="6"
          fill="rgba(109,94,252,0.75)"></rect>`,
      );

      // valor no topo
      const vy = Math.max(pad.top + 12, y - 6);
      const vtxt = _escapeXml(format(v));
      bars.push(
        `<text x="${x + barW / 2}" y="${vy}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.75)">
          ${vtxt}
        </text>`,
      );

      // label dia
      const lx = x + barW / 2;
      const ly = baseY + 18;
      const txt = _escapeXml(String(labels[i] ?? ""));
      xLabels.push(
        `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.70)">
          ${txt}
        </text>`,
      );
    }

    const baseLine = `<line x1="${pad.left}" y1="${baseY}" x2="${pad.left + innerW}" y2="${baseY}"
      stroke="rgba(255,255,255,0.14)" />`;

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Gráfico de barras">
        ${baseLine}
        ${bars.join("")}
        ${xLabels.join("")}
      </svg>
    `;
  },

  /**
   * Donut chart SVG
   * @param {Object} params
   * @param {{label:string,value:number}[]} params.items
   * @param {number} params.size
   */
  donutChartSVG({ items = [], size = 220 } = {}) {
    const data = (items || [])
      .map((x) => ({
        label: String(x.label ?? ""),
        value: Number(x.value) || 0,
      }))
      .filter((x) => x.value > 0);

    if (!data.length)
      return `<div class="muted small">Sem dados para o gráfico.</div>`;

    const total = data.reduce((a, b) => a + b.value, 0) || 1;

    const s = Math.max(180, Number(size) || 220);
    const cx = s / 2;
    const cy = s / 2;
    const r = Math.round(s * 0.32);
    const strokeW = Math.round(s * 0.12);

    const C = 2 * Math.PI * r;

    const colorFor = (i) => {
      const hue = (i * 57) % 360;
      return `hsl(${hue} 85% 62%)`;
    };

    let offset = 0;
    const segs = data.map((d, i) => {
      const frac = d.value / total;
      const dash = frac * C;
      const gap = 2; // espacinho entre segmentos
      const seg = `
        <circle
          cx="${cx}" cy="${cy}" r="${r}"
          fill="none"
          stroke="${colorFor(i)}"
          stroke-width="${strokeW}"
          stroke-linecap="round"
          stroke-dasharray="${Math.max(0, dash - gap)} ${C}"
          stroke-dashoffset="${-offset}"
          transform="rotate(-90 ${cx} ${cy})"
        />`;
      offset += dash;
      return seg;
    });

    const legend = data
      .slice(0, 6)
      .map((d, i) => {
        const pct = Math.round((d.value / total) * 100);
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
            <span style="width:10px;height:10px;border-radius:4px;background:${colorFor(i)};display:inline-block"></span>
            <div style="min-width:0">
              <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${_escapeHtml(d.label)}
              </div>
              <div class="muted small">${pct}%</div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" role="img" aria-label="Gráfico donut">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="${strokeW}" />
          ${segs.join("")}
          <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
            font-size="14" font-weight="800" fill="rgba(255,255,255,0.85)">
            ${Math.round(total).toLocaleString("pt-BR")}
          </text>
        </svg>

        <div style="flex:1;min-width:180px">
          ${legend}
        </div>
      </div>
    `;
  },
};

// helpers
function _escapeXml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function _escapeHtml(str) {
  return _escapeXml(str);
}
