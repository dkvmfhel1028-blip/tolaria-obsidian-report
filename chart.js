// 분석 리포트 차트 (단일 계열). index.html의 [data-chart] 안 <script type="application/json" class="chart-data">를 읽어 그린다.
// 데이터 형식:
//   { "type": "bar" | "hbar",
//     "label": "month", "value": "median",          // 항목 이름 키, 값 키
//     "sub": "uploads", "subSuffix": "편",           // (선택) 막대 아래 둘째 줄
//     "unit": "회", "max": 4000000, "ticks": 4,       // (선택) 툴팁 단위, 축 최대값, 눈금 수
//     "labelAt": ["2025.11", "2026.09"],             // (선택) 값을 막대 위에 직접 쓸 항목(전부 쓰지 않기)
//     "tooltip": ["uploads:업로드:편", "max:최고:회"], // (선택) 툴팁에 더 보여줄 키:이름:단위
//     "rows": [ { "month": "2025.11", "median": 2042129, "uploads": 13, "max": 10485007 }, ... ] }
// 값이 null이면 막대 대신 "없음"을 쓴다. 표 보기(<details class="table-view">)가 있으면 자동으로 채운다.

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, text) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
};
const short = (n) => {
  if (n === null || n === undefined) return "-";
  if (Math.abs(n) >= 100000000) return +(n / 100000000).toFixed(2) + "억";
  if (Math.abs(n) >= 10000) return +(n / 10000).toFixed(n >= 1000000 ? 0 : 1) + "만";
  return n.toLocaleString("ko-KR");
};
const full = (n) => (n === null || n === undefined ? "-" : n.toLocaleString("ko-KR"));

function niceMax(v, ticks) {
  const raw = v / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  return step * ticks;
}

function bindTooltip(root, hit, html) {
  const tip = root.querySelector(".tooltip");
  hit.addEventListener("mousemove", (e) => {
    const box = root.querySelector(".chart").getBoundingClientRect();
    tip.innerHTML = html;
    tip.classList.add("show");
    tip.style.setProperty("left", Math.min(e.clientX - box.left + 12, box.width - 190) + "px");
    tip.style.setProperty("top", e.clientY - box.top - 72 + "px");
  });
  hit.addEventListener("mouseleave", () => tip.classList.remove("show"));
}

function tipHtml(cfg, d) {
  const extra = (cfg.tooltip || []).map((s) => {
    const [k, name, unit] = s.split(":");
    return `<br>${name} ${full(d[k])}${unit || ""}`;
  });
  return `<b>${d[cfg.label]}</b><br>${full(d[cfg.value])}${cfg.unit || ""}${extra.join("")}`;
}

function barPath(x0, x1, yBase, yTop, horizontal) {
  // 바닥(기준선) 쪽은 각지게, 끝만 4px 둥글게
  if (!horizontal) {
    const r = Math.min(4, yBase - yTop, (x1 - x0) / 2);
    return `M${x0},${yBase} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x1 - r} Q${x1},${yTop} ${x1},${yTop + r} V${yBase} Z`;
  }
  const [y0, y1, xb, xe] = [x0, x1, yBase, yTop];
  const r = Math.min(4, xe - xb, (y1 - y0) / 2);
  return `M${xb},${y0} H${xe - r} Q${xe},${y0} ${xe},${y0 + r} V${y1 - r} Q${xe},${y1} ${xe - r},${y1} H${xb} Z`;
}

function drawBar(root, cfg) {
  const W = 960, H = 300, L = 52, R = 12, T = 28, B = cfg.sub ? 48 : 30;
  const ticks = cfg.ticks || 4;
  const vals = cfg.rows.map((d) => d[cfg.value]).filter((v) => v !== null);
  const max = cfg.max || niceMax(Math.max(...vals), ticks);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": root.querySelector(".chart-title")?.textContent || "차트" });
  const y = (v) => T + (H - T - B) * (1 - v / max);
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    svg.appendChild(el("line", { class: "gridline", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    svg.appendChild(el("text", { class: "axis-label", x: L - 8, y: y(v) + 4, "text-anchor": "end" }, v ? short(v) : "0"));
  }
  const step = (W - L - R) / cfg.rows.length;
  const bw = Math.min(44, step - 14);
  cfg.rows.forEach((d, i) => {
    const cx = L + step * i + step / 2;
    const name = String(d[cfg.label]);
    svg.appendChild(el("text", { class: "axis-label", x: cx, y: H - B + 18, "text-anchor": "middle" }, name.length > 6 ? name.slice(-5) : name));
    if (cfg.sub) svg.appendChild(el("text", { class: "axis-label", x: cx, y: H - B + 34, "text-anchor": "middle" }, d[cfg.sub] + (cfg.subSuffix || "")));
    const v = d[cfg.value];
    if (v === null || v === undefined) {
      svg.appendChild(el("text", { class: "zero-label", x: cx, y: y(0) - 6, "text-anchor": "middle" }, "없음"));
      return;
    }
    const top = Math.min(y(v), y(0) - 2);
    const hit = el("rect", { class: "bar-hit", x: cx - step / 2, y: T, width: step, height: H - T - B });
    svg.appendChild(hit);
    svg.appendChild(el("path", { class: "bar", d: barPath(cx - bw / 2, cx + bw / 2, y(0), top) }));
    if ((cfg.labelAt || []).includes(d[cfg.label])) svg.appendChild(el("text", { class: "value-label", x: cx, y: top - 6, "text-anchor": "middle" }, short(v)));
    bindTooltip(root, hit, tipHtml(cfg, d));
  });
  return svg;
}

function drawHbar(root, cfg) {
  const rowH = 30, L = 260, R = 80, T = 6, W = 960;
  const H = T * 2 + rowH * cfg.rows.length;
  const max = cfg.max || Math.max(...cfg.rows.map((d) => d[cfg.value] || 0));
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": root.querySelector(".chart-title")?.textContent || "차트" });
  const x = (v) => L + (W - L - R) * (v / max);
  cfg.rows.forEach((d, i) => {
    const y0 = T + rowH * i + 6, y1 = y0 + rowH - 12;
    const name = String(d[cfg.label]);
    svg.appendChild(el("text", { class: "hbar-label", x: L - 10, y: y0 + 13, "text-anchor": "end" }, name.length > 22 ? name.slice(0, 21) + "…" : name));
    const hit = el("rect", { class: "bar-hit", x: 0, y: y0 - 4, width: W, height: rowH });
    svg.appendChild(hit);
    svg.appendChild(el("path", { class: "bar", d: barPath(y0, y1, L, Math.max(x(d[cfg.value]), L + 2), true) }));
    svg.appendChild(el("text", { class: "hbar-value", x: x(d[cfg.value]) + 8, y: y0 + 13 }, short(d[cfg.value])));
    bindTooltip(root, hit, tipHtml(cfg, d));
  });
  return svg;
}

function fillTable(root, cfg) {
  const table = root.querySelector(".table-view table");
  if (!table) return;
  const keys = [cfg.label, cfg.value, ...(cfg.sub ? [cfg.sub] : []), ...(cfg.tooltip || []).map((s) => s.split(":")[0])].filter((k, i, a) => a.indexOf(k) === i);
  const names = cfg.columns || keys;
  table.innerHTML = `<thead><tr>${names.map((n) => `<th>${n}</th>`).join("")}</tr></thead>`;
  const tbody = document.createElement("tbody");
  cfg.rows.forEach((d) => {
    const tr = document.createElement("tr");
    keys.forEach((k, i) => {
      const td = document.createElement("td");
      td.textContent = i === 0 ? d[k] : full(d[k]);
      if (i) td.className = "num";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

document.querySelectorAll("[data-chart]").forEach((root) => {
  const cfg = JSON.parse(root.querySelector(".chart-data").textContent);
  const svg = cfg.type === "hbar" ? drawHbar(root, cfg) : drawBar(root, cfg);
  root.querySelector(".chart").prepend(svg);
  fillTable(root, cfg);
});
