// SVG drawings used across the site, returned as strings for set:html.

// Football player. Helmet, jersey, pants and socks use the team's two colors.
export function playerSVG(p, q, num) {
  const ink = "#17181c", skin = "#c98d63";
  const sw = `stroke="${ink}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const n = String(num ?? "").slice(0, 2);
  return `<svg viewBox="0 0 200 270" aria-hidden="true">
  <path d="M42 142 C34 160 36 176 44 186" fill="none" stroke="${ink}" stroke-width="22" stroke-linecap="round"/>
  <path d="M42 142 C34 160 36 176 44 186" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
  <path d="M158 142 C166 156 166 168 158 178" fill="none" stroke="${ink}" stroke-width="22" stroke-linecap="round"/>
  <path d="M158 142 C166 156 166 168 158 178" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
  <rect x="58" y="230" width="32" height="26" fill="${p}" ${sw}/><rect x="110" y="230" width="32" height="26" fill="${p}" ${sw}/>
  <path d="M60 240 H88 M112 240 H140" stroke="${q}" stroke-width="5"/>
  <ellipse cx="72" cy="260" rx="22" ry="8" fill="${ink}"/><ellipse cx="128" cy="260" rx="22" ry="8" fill="${ink}"/>
  <path d="M54 188 H146 L144 232 L108 234 L100 208 L92 234 L56 232 Z" fill="${q}" ${sw}/>
  <path d="M58 194 L60 228 M142 194 L140 228" stroke="${p}" stroke-width="5"/>
  <rect x="88" y="82" width="24" height="14" fill="${skin}" ${sw}/>
  <path d="M38 106 C38 92 60 88 88 90 L112 90 C140 88 162 92 162 106 L164 142 L148 144 L146 192 L54 192 L52 144 L36 142 Z" fill="${p}" ${sw}/>
  <path d="M38 124 L52 126 M162 124 L148 126" stroke="${q}" stroke-width="6"/>
  <path d="M88 90 L100 104 L112 90" fill="none" stroke="${q}" stroke-width="5"/>
  <text x="100" y="166" text-anchor="middle" font-family="Archivo Black,Arial Black,sans-serif" font-size="44" fill="${q}" stroke="${ink}" stroke-width="2.5" paint-order="stroke">${n}</text>
  <circle cx="45" cy="190" r="9" fill="${q}" ${sw}/>
  <g transform="rotate(-28 160 184)"><ellipse cx="160" cy="184" rx="20" ry="12" fill="#8b4a26" ${sw}/><path d="M152 184 H168 M155 180 V188 M160 180 V188 M165 180 V188" stroke="#fff" stroke-width="2.5"/></g>
  <ellipse cx="100" cy="50" rx="38" ry="40" fill="${p}" ${sw}/>
  <path d="M100 12 V44" stroke="${q}" stroke-width="9"/>
  <rect x="78" y="44" width="44" height="36" rx="11" fill="${skin}" ${sw}/>
  <circle cx="91" cy="56" r="3" fill="${ink}"/><circle cx="109" cy="56" r="3" fill="${ink}"/>
  <path d="M74 60 H126 M76 70 H124 M100 60 V80" stroke="#e9e6dc" stroke-width="5" stroke-linecap="round"/>
  <circle cx="64" cy="58" r="6" fill="${q}" ${sw}/><circle cx="136" cy="58" r="6" fill="${q}" ${sw}/>
  </svg>`;
}

const dash = 'stroke="#6b6860" stroke-width="2.5" stroke-dasharray="5 4"';
export function cupSVG(kind, ghost) {
  const colors = { gold: ["#f2c230", "#c88a12"], silver: ["#d4d9e1", "#8e96a3"], bronze: ["#d99360", "#9b5a2c"] }[kind];
  const [c, d] = ghost ? ["none", "none"] : colors;
  const st = ghost ? dash : 'stroke="#17181c" stroke-width="2.5"';
  const handle = ghost ? dash : `stroke="${colors[1]}" stroke-width="5"`;
  return `<svg viewBox="0 0 80 100" class="${ghost ? "ghost" : ""}" aria-hidden="true">
  <path d="M19 22 C4 22 4 46 23 48" fill="none" ${handle}/><path d="M61 22 C76 22 76 46 57 48" fill="none" ${handle}/>
  <path d="M17 12 H63 V28 C63 46 53 57 40 57 C27 57 17 46 17 28 Z" fill="${c}" ${st}/>
  <rect x="36" y="57" width="8" height="13" fill="${d}" ${st}/>
  <path d="M26 70 H54 L58 82 H22 Z" fill="${d}" ${st}/>
  <rect x="18" y="82" width="44" height="12" rx="2" fill="${ghost ? "none" : "#3b2a1a"}" ${st}/>
  ${ghost ? "" : '<path d="M25 18 C25 32 29 43 35 49" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="3" stroke-linecap="round"/>'}
  </svg>`;
}
export function toiletSVG(ghost) {
  const st = ghost ? dash : 'stroke="#17181c" stroke-width="2.5"';
  const f = (c) => (ghost ? "none" : c);
  return `<svg viewBox="0 0 80 100" class="${ghost ? "ghost" : ""}" aria-hidden="true">
  <rect x="22" y="8" width="36" height="24" rx="4" fill="${f("#f6f3ec")}" ${st}/>
  <path d="M14 36 H66 C66 52 56 61 48 63 L50 82 H30 L32 63 C24 61 14 52 14 36 Z" fill="${f("#f6f3ec")}" ${st}/>
  <ellipse cx="40" cy="36" rx="26" ry="5" fill="${f("#dcd6c8")}" ${st}/>
  <rect x="18" y="82" width="44" height="12" rx="2" fill="${f("#c99a2e")}" ${st}/>
  ${ghost ? "" : '<path d="M27 14 V26" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'}
  </svg>`;
}

// Hand-drawn line chart. points: [{label, value, win}]
export function scoreChart(points, { avg, notes = true } = {}) {
  if (points.length < 2) return "";
  const w = 560, h = 170, x0 = 40, x1 = w - 24, top = 26, bottom = h - 26;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(8, (hi - lo) * 0.15);
  lo = Math.floor((lo - pad) / 10) * 10; hi = Math.ceil((hi + pad) / 10) * 10;
  const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const x = (i) => x0 + (i * (x1 - x0)) / (points.length - 1);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const every = Math.ceil(points.length / 9);
  const iHi = vals.indexOf(Math.max(...vals)), iLo = vals.indexOf(Math.min(...vals));
  const ref = avg ?? (lo + hi) / 2;
  const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(2));
  const noteAt = (i, text, color, below) => {
    const anchor = i > points.length * 0.6 ? "end" : "start";
    const dx = anchor === "end" ? -10 : 10;
    return `<text x="${x(i) + dx}" y="${y(points[i].value) + (below ? 20 : -10)}" text-anchor="${anchor}" font-family="Caveat,cursive" font-weight="700" font-size="20" fill="${color}">${text}</text>`;
  };
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Line chart of ${points.length} values">
  <line x1="${x0}" x2="${x1}" y1="${y(ref)}" y2="${y(ref)}" stroke="#6b6860" stroke-dasharray="4 5" stroke-width="1.5"/>
  <text x="${x0 - 6}" y="${y(ref) + 4}" text-anchor="end" font-family="Archivo,sans-serif" font-weight="700" font-size="11" fill="#6b6860">${Math.round(ref)}</text>
  <path d="${path}" fill="none" stroke="#2448b8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${path}" fill="none" stroke="#2448b8" stroke-width="1.5" transform="translate(1.5 -2)" opacity=".45"/>
  ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="5" fill="${p.win ? "#d3262f" : "#fbf9f3"}" stroke="#17181c" stroke-width="2"><title>${p.label}: ${fmt(p.value)}</title></circle>${i % every === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${h - 6}" text-anchor="middle" font-family="Archivo,sans-serif" font-weight="700" font-size="11" fill="#6b6860">${p.label}</text>` : ""}`).join("")}
  ${notes ? noteAt(iHi, `${fmt(points[iHi].value)}! best`, "#2448b8", false) + noteAt(iLo, `ouch. ${fmt(points[iLo].value)}`, "#d3262f", true) : ""}
  </svg>`;
}

export const doodleSVG = `<svg class="doodle" viewBox="0 0 210 120" fill="none" stroke="#17181c" stroke-width="3" stroke-linecap="round" aria-hidden="true"><circle cx="30" cy="88" r="11"/><circle cx="70" cy="96" r="11"/><circle cx="110" cy="88" r="11"/><path d="M140 22l16 16M156 22l-16 16M178 64l16 16M194 64l-16 16"/><path d="M30 76C40 40 70 30 120 36" stroke="#d3262f"/><path d="M114 30l8 6-9 5" stroke="#d3262f"/><path d="M110 76c10-30 40-30 60-10" stroke="#2f57c4" stroke-dasharray="6 6"/></svg>`;
