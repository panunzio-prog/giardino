// Mappa dall'alto (stesso disegno della pagina Mappa del PC), con zoom a due dita, spostamento e tocco sulle piante.
(function () {
  const G = window.Giardino;
  const { Q, TIPI_ATTIVITA, CATEGORIE, TIPI_ZONA, MESI_LUNGHI } = G;
  const S = 25; // unità SVG per metro (come sul PC)

  const FILTRI = { tutte: 'Tutte', da_fare: 'Da fare', potatura: 'Potare', concimazione: 'Concimare',
    trattamento: 'Trattare', raccolta: 'Raccogliere' };

  const st = {
    mese: G.meseCorrente(), filtro: 'tutte', chiome: false, etichette: true,
    vb: null, // viewBox corrente [x, y, w, h]
    spostando: null, // {pid, x, y, x0, y0}
  };

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pts = pp => pp.map(([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`).join(' ');

  function stileZona(z) {
    const s = Object.assign({}, TIPI_ZONA[z.tipo] || TIPI_ZONA.altro);
    if (z.colore) s.fill = z.colore;
    return s;
  }

  function statoPianta(d, p) {
    const s = Q.specie(d, p.specie_id);
    if (!s || st.filtro === 'tutte') return [true, false, null];
    const tipi = st.filtro === 'da_fare' ? ['potatura', 'concimazione', 'trattamento'] : [st.filtro];
    const att = (s.attivita || []).filter(a => (a.mesi || []).includes(st.mese) && tipi.includes(a.tipo));
    if (!att.length) return [false, false, null];
    const fatte = att.every(a => Q.fattoStagione(d, a, p.id, G.annoCorrente()));
    const col = st.filtro !== 'da_fare' ? TIPI_ATTIVITA[att[0].tipo].colore : '#d32f2f';
    return [true, fatte, col];
  }

  function iconaSvg(s, cx, cy, lato) {
    const ic = window.ICONE && window.ICONE[s.id];
    if (ic) {
      return `<svg x="${(cx - lato / 2).toFixed(1)}" y="${(cy - lato / 2).toFixed(1)}" width="${lato.toFixed(1)}" ` +
        `height="${lato.toFixed(1)}" viewBox="0 0 64 64" overflow="visible">${ic}</svg>`;
    }
    return `<text x="${cx.toFixed(1)}" y="${(cy + lato * 0.3).toFixed(1)}" font-size="${(lato * 0.8).toFixed(1)}" ` +
      `text-anchor="middle">${esc(s.icona || '🌱')}</text>`;
  }

  // unità SVG per pixel dello schermo (per tenere le piante grandi uguali a ogni zoom)
  function unitaPerPx() {
    const box = document.getElementById('mappa-box');
    if (!box || !st.vb) return 1;
    return Math.max(st.vb[2] / box.clientWidth, st.vb[3] / box.clientHeight);
  }

  function costruisci(d, selId) {
    const imp = d.impostazioni;
    const W = imp.larghezza_m, H = imp.altezza_m;
    const u = unitaPerPx();
    const out = ['<defs>' +
      '<pattern id="tetto" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line x1="0" y1="0" x2="0" y2="8" stroke="#c9bfb1" stroke-width="2"/></pattern>' +
      '<pattern id="erba" width="14" height="14" patternUnits="userSpaceOnUse">' +
      '<path d="M3 10 l1 -4 M7 12 l1 -4 M11 9 l1 -4" stroke="#b4d79a" stroke-width="1" fill="none"/></pattern>' +
      '<pattern id="fuori" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line x1="0" y1="0" x2="0" y2="10" stroke="#e6e6e1" stroke-width="3"/></pattern></defs>'];
    out.push(`<rect x="-2000" y="-2000" width="${W * S + 4000}" height="${H * S + 4000}" fill="#f5f5f1"/>`);
    out.push(`<rect x="0" y="0" width="${W * S}" height="${H * S}" fill="url(#fuori)"/>`);
    const conf = imp.confine || [];
    const zone = [...d.zone].filter(z => z.punti && z.punti.length >= 3).sort((a, b) => stileZona(a).z - stileZona(b).z);

    const zona = z => {
      const sz = stileZona(z);
      const sel = selId === z.id;
      out.push(`<polygon points="${pts(z.punti)}" fill="${sz.fill}" fill-opacity="${z.tipo === 'chioma' ? 0.75 : 1}" ` +
        `stroke="${sel ? '#d84315' : sz.stroke}" stroke-width="${sel ? 4 : (z.tipo === 'casa' ? 2.5 : 1.5)}" ` +
        `stroke-dasharray="${sz.dash}" stroke-linejoin="round"/>`);
      if (z.tipo === 'casa') out.push(`<polygon points="${pts(z.punti)}" fill="url(#tetto)"/>`);
      else if (z.tipo === 'prato') out.push(`<polygon points="${pts(z.punti)}" fill="url(#erba)"/>`);
    };
    const etichetta = z => {
      const [cx, cy] = G.centroPoligono(z.punti);
      if (z.tipo === 'strada') {
        out.push(`<text x="${cx * S}" y="${cy * S}" font-size="15" fill="#6b7177" font-weight="600" letter-spacing="3" ` +
          `text-anchor="middle" transform="rotate(-85 ${cx * S} ${cy * S})">${esc(z.nome).toUpperCase()}</text>`);
        return;
      }
      const grande = z.tipo === 'casa';
      out.push(`<text x="${cx * S}" y="${cy * S + 4}" font-size="${grande ? 18 : 11}" font-weight="${grande ? 700 : 600}" ` +
        `fill="${grande ? '#4e443a' : '#3d5a2a'}" text-anchor="middle" stroke="white" stroke-width="${grande ? 0 : 3}" ` +
        `paint-order="stroke" opacity="0.9">${esc(z.nome)}</text>`);
    };

    zone.filter(z => z.tipo === 'strada').forEach(zona);
    if (conf.length >= 3) out.push(`<polygon points="${pts(conf)}" fill="#eef6e4" stroke="none"/>`);
    zone.filter(z => !['strada', 'chioma'].includes(z.tipo)).forEach(zona);
    if (conf.length >= 3) out.push(`<polygon points="${pts(conf)}" fill="none" stroke="#8d2a1f" stroke-width="3" stroke-linejoin="round"/>`);
    zone.filter(z => z.tipo === 'chioma').forEach(zona);
    zone.forEach(etichetta);

    // piante: le grandi prima, così le piccole restano sopra
    const piante = d.piante.filter(p => p.x != null && Q.specie(d, p.specie_id))
      .sort((a, b) => Q.diametroPianta(d, b) - Q.diametroPianta(d, a));
    const rMin = 13 * u; // almeno 13 px sullo schermo
    for (const p0 of piante) {
      const p = (st.spostando && st.spostando.pid === p0.id) ? Object.assign({}, p0, { x: st.spostando.x, y: st.spostando.y }) : p0;
      const s = Q.specie(d, p.specie_id);
      let [ok, fatte, anello] = statoPianta(d, p);
      const col = (CATEGORIE[s.categoria] || CATEGORIE.altro).colore;
      const sel = selId === p.id;
      const cx = p.x * S, cy = p.y * S;
      const r = st.chiome ? Math.max(Q.diametroPianta(d, p) / 2 * S, rMin) : rMin;
      out.push(`<g opacity="${ok ? 1 : 0.2}">`);
      if (anello && ok) {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 5 * u}" fill="none" stroke="${fatte ? '#43a047' : anello}" ` +
          `stroke-width="${4 * u}" stroke-dasharray="${fatte ? `${4 * u} ${3 * u}` : ''}"/>`);
      }
      if (st.chiome) {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" fill-opacity="0.45" stroke="${sel ? '#000' : col}" ` +
          `stroke-width="${(sel ? 3 : 1.5) * u}"/>`);
        out.push(iconaSvg(s, cx, cy, Math.min(Math.max(r * 1.25, 18 * u), 34 * u)));
      } else {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" fill-opacity="0.9" stroke="${sel ? '#000' : col}" ` +
          `stroke-width="${(sel ? 3 : 2) * u}"/>`);
        out.push(iconaSvg(s, cx, cy, r * 1.7));
      }
      if (sel) out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 7 * u}" fill="none" stroke="#000" stroke-width="${2 * u}" stroke-dasharray="${5 * u} ${3 * u}"/>`);
      if (st.etichette && u < 1.3) {
        out.push(`<text x="${cx}" y="${cy + r + 11 * u}" font-size="${10 * u}" text-anchor="middle" fill="#263238" ` +
          `stroke="white" stroke-width="${3 * u}" paint-order="stroke">${esc(p.etichetta || s.nome)}</text>`);
      }
      if (fatte && ok) {
        out.push(`<text x="${cx + r * 0.7}" y="${cy - r * 0.6}" font-size="${14 * u}" fill="#2e7d32" font-weight="700">✓</text>`);
      }
      out.push('</g>');
    }

    // nord
    const nx = W * S - 40, ny = 45;
    out.push(`<g><circle cx="${nx}" cy="${ny}" r="22" fill="white" stroke="#90a4ae"/>` +
      `<path d="M${nx} ${ny - 17} L${nx + 8} ${ny + 9} L${nx} ${ny + 4} L${nx - 8} ${ny + 9} Z" fill="#455a64"/>` +
      `<text x="${nx}" y="${ny + 20}" font-size="10" text-anchor="middle" fill="#455a64" font-weight="700">N</text></g>`);
    return out.join('');
  }

  // ------------------------------------------------------------------ pagina
  let selezione = null; // id pianta o zona
  let svgEl = null;
  let ridisegnoAttesa = null;

  function vbIniziale(d) {
    const box = document.getElementById('mappa-box');
    const rb = box.clientWidth / box.clientHeight;
    // il lotto (confine + piante) riempie lo schermo, con un margine sopra per i filtri
    const punti = [...(d.impostazioni.confine || []), ...d.piante.filter(p => p.x != null).map(p => [p.x, p.y])];
    if (punti.length < 2) punti.push([0, 0], [d.impostazioni.larghezza_m, d.impostazioni.altezza_m]);
    const xs = punti.map(p => p[0] * S), ys = punti.map(p => p[1] * S);
    const x0 = Math.min(...xs) - 25, x1 = Math.max(...xs) + 25, y0 = Math.min(...ys) - 25, y1 = Math.max(...ys) + 25;
    let w = x1 - x0, h = y1 - y0;
    const filtri = 50 / box.clientHeight; // quota dello schermo coperta dai filtri
    if (w / (h * (1 + filtri)) > rb) h = w / rb; else { h = h * (1 + filtri); w = h * rb; }
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2 - h * filtri / 2, w, h];
  }

  function applicaVb() {
    if (svgEl && st.vb) svgEl.setAttribute('viewBox', st.vb.map(v => v.toFixed(2)).join(' '));
  }

  function ridisegna() {
    const d = G.Archivio.d;
    if (!svgEl || !d) return;
    svgEl.innerHTML = costruisci(d, selezione);
    applicaVb();
  }
  function ridisegnaPresto() {
    clearTimeout(ridisegnoAttesa);
    ridisegnoAttesa = setTimeout(ridisegna, 120);
  }

  function aMetri(clientX, clientY) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = svgEl.getScreenCTM().inverse();
    const q = pt.matrixTransform(m);
    return [q.x / S, q.y / S];
  }

  function trovaPianta(d, x, y) {
    const u = unitaPerPx();
    let migliore = null, dm = Infinity;
    for (const p of d.piante) {
      if (p.x == null) continue;
      const dist = Math.hypot(p.x - x, p.y - y) * S;
      const raggio = Math.max(st.chiome ? Q.diametroPianta(d, p) / 2 * S : 0, 22 * u);
      if (dist <= raggio && dist < dm) { migliore = p; dm = dist; }
    }
    return migliore;
  }

  function trovaZona(d, x, y) {
    const cand = d.zone.filter(z => z.punti && z.punti.length >= 3 && z.tipo !== 'strada' && G.dentro(x, y, z.punti));
    if (!cand.length) return null;
    return cand.reduce((m, z) => (G.areaPoligono(z.punti) < G.areaPoligono(m.punti) ? z : m));
  }

  // --------------------------------------------------------- gesti (touch)
  function collegaGesti(box) {
    const dita = new Map();
    let inizio = null; // {x, y, t, vb, dist, mid}
    let mosso = false;

    box.addEventListener('pointerdown', e => {
      box.setPointerCapture(e.pointerId);
      dita.set(e.pointerId, [e.clientX, e.clientY]);
      mosso = false;
      inizio = { x: e.clientX, y: e.clientY, t: Date.now(), vb: [...st.vb], n: dita.size };
      if (dita.size === 2) {
        const [a, b] = [...dita.values()];
        inizio.dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        inizio.mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        inizio.midM = aMetri(...inizio.mid);
      } else if (st.spostando) {
        const [x, y] = aMetri(e.clientX, e.clientY);
        const dist = Math.hypot(x - st.spostando.x, y - st.spostando.y) * S;
        inizio.trascina = dist <= 30 * unitaPerPx();
      }
    });

    box.addEventListener('pointermove', e => {
      if (!dita.has(e.pointerId) || !inizio) return;
      dita.set(e.pointerId, [e.clientX, e.clientY]);
      if (Math.hypot(e.clientX - inizio.x, e.clientY - inizio.y) > 8) mosso = true;
      if (dita.size >= 2 && inizio.dist) {
        const [a, b] = [...dita.values()];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const f = inizio.dist / Math.max(dist, 1);
        const vb0 = inizio.vb;
        let w = Math.min(Math.max(vb0[2] * f, 150), 6000);
        const k = w / vb0[2];
        const h = vb0[3] * k;
        // il punto sotto le dita resta fermo
        const rect = box.getBoundingClientRect();
        const fx = (mid[0] - rect.left) / rect.width, fy = (mid[1] - rect.top) / rect.height;
        const mx = inizio.midM[0] * S, my = inizio.midM[1] * S;
        st.vb = [mx - fx * w, my - fy * h, w, h];
        applicaVb();
        ridisegnaPresto();
      } else if (dita.size === 1 && inizio.n === 1) {
        if (inizio.trascina && st.spostando) {
          const [x, y] = aMetri(e.clientX, e.clientY);
          st.spostando.x = x; st.spostando.y = y;
          ridisegna();
          return;
        }
        const rect = box.getBoundingClientRect();
        const k = Math.max(inizio.vb[2] / rect.width, inizio.vb[3] / rect.height);
        st.vb = [inizio.vb[0] - (e.clientX - inizio.x) * k, inizio.vb[1] - (e.clientY - inizio.y) * k, inizio.vb[2], inizio.vb[3]];
        applicaVb();
      }
    });

    const fine = e => {
      if (!dita.has(e.pointerId)) return;
      dita.delete(e.pointerId);
      if (dita.size === 0 && inizio && inizio.n === 1 && !mosso && Date.now() - inizio.t < 600) tocco(e.clientX, e.clientY);
      if (dita.size === 0) inizio = null;
      else if (dita.size === 1) { // da due dita a una: riparte lo spostamento
        const [p] = [...dita.values()];
        inizio = { x: p[0], y: p[1], t: Date.now(), vb: [...st.vb], n: 2 };
      }
    };
    box.addEventListener('pointerup', fine);
    box.addEventListener('pointercancel', fine);
  }

  function tocco(cx, cy) {
    const d = G.Archivio.d;
    const [x, y] = aMetri(cx, cy);
    if (st.spostando) { // in "Sposta" un tocco porta la pianta lì
      st.spostando.x = x; st.spostando.y = y;
      ridisegna();
      return;
    }
    const p = trovaPianta(d, x, y);
    if (p) { selezione = p.id; ridisegna(); apriPianta(p.id); return; }
    const z = trovaZona(d, x, y);
    if (z) { selezione = z.id; ridisegna(); apriZona(z.id); return; }
    selezione = null; ridisegna();
  }

  // ------------------------------------------------------- foglio pianta
  function htmlMesi(mesi, colore, ora) {
    return '<div class="mesi">' + G.MESI.map((m, i) => (mesi || []).includes(i + 1)
      ? `<span class="mese-chip on${i + 1 === ora ? ' ora' : ''}" style="background:${colore}">${m}</span>`
      : `<span class="mese-chip">${m}</span>`).join('') + '</div>';
  }

  function apriPianta(pid) {
    const d = G.Archivio.d;
    const p = Q.pianta(d, pid);
    if (!p) return;
    const s = Q.specie(d, p.specie_id);
    const z = Q.zonaDi(d, p);
    const anno = G.annoCorrente();
    const att = (s.attivita || []).filter(a => (a.mesi || []).includes(st.mese));
    const kg = Q.kgPianta(d, pid, anno);
    let h = `<div class="riga">${UI.iconaSpecie(s, 48)}<div class="cresce"><h2 style="margin:0">${esc(Q.nomePianta(d, p))}</h2>` +
      `<div class="piccolo"><i>${esc(s.nome_scientifico || '')}</i>${z ? ' · ' + esc(z.nome) : ''}</div></div></div>`;
    h += `<div class="titolo-sez" style="font-size:16px">Lavori di ${MESI_LUNGHI[st.mese - 1].toLowerCase()}</div>`;
    if (!att.length) h += '<div class="piccolo">Niente in programma questo mese.</div>';
    for (const a of att) {
      const t = TIPI_ATTIVITA[a.tipo] || TIPI_ATTIVITA.altro;
      const f = Q.fattoStagione(d, a, pid, anno);
      h += `<label class="spunta"><input type="checkbox" data-att="${a.id}" ${f ? 'checked' : ''}>` +
        `<div class="cresce"><b style="color:${t.colore}">${t.emoji} ${esc(a.titolo)}</b>` +
        `${a.prodotto || a.dose ? `<div class="piccolo">🧴 ${esc([a.prodotto, a.dose].filter(Boolean).join(' · '))}</div>` : ''}` +
        `${f ? `<div class="piccolo" style="color:#2e7d32">✓ fatto il ${esc(f.data)}</div>` : ''}</div></label>`;
    }
    h += `<div class="titolo-sez" style="font-size:16px">Raccolto ${anno}: ${kg ? kg.toFixed(2).replace('.', ',') + ' kg' : '—'}</div>`;
    h += '<div class="riga"><input id="kg" type="text" inputmode="decimal" placeholder="kg" ' +
      'style="width:110px;padding:9px;border-radius:10px;border:1px solid var(--linea);background:var(--fondo)">' +
      '<button class="btn piccolo-btn" id="btn-kg">🧺 Registra</button></div>';
    h += '<div class="titolo-sez" style="font-size:16px">Taglia chioma</div><div class="chips">' +
      Object.entries(G.TAGLIE).map(([k, v]) => `<button class="chip${parseFloat(p.diametro_m) === v ? ' on' : ''}" data-taglia="${v}">${k} · ${String(v).replace('.', ',')} m</button>`).join('') +
      `<button class="chip${!p.diametro_m ? ' on' : ''}" data-taglia="">Scheda</button></div>`;
    h += '<div class="riga" style="margin-top:14px;gap:8px">' +
      `<button class="btn leggero cresce" id="btn-scheda">📇 Scheda</button>` +
      `<button class="btn leggero cresce" id="btn-sposta">✥ Sposta</button>` +
      `<button class="btn leggero cresce" id="btn-diario">📝 Nota</button></div>`;

    UI.foglio(h, el => {
      el.querySelectorAll('input[data-att]').forEach(cb => cb.addEventListener('change', async () => {
        const ok = await UI.salva(dd => G.Mod.segnaFatto(dd, s.id, cb.dataset.att, pid, st.mese, cb.checked),
          cb.checked ? 'Segnato come fatto' : 'Tolto dal diario');
        if (ok) { ridisegna(); apriPianta(pid); } else cb.checked = !cb.checked;
      }));
      el.querySelector('#btn-kg').addEventListener('click', async () => {
        const v = parseFloat(String(el.querySelector('#kg').value).replace(',', '.'));
        if (!(v > 0)) { UI.avviso('Scrivi i kg raccolti'); return; }
        const ok = await UI.salva(dd => G.Mod.registra(dd, { tipo: 'raccolta', descrizione: 'Raccolto', pianta_id: pid, kg: v }),
          `Registrati ${v} kg`);
        if (ok) apriPianta(pid);
      });
      el.querySelectorAll('[data-taglia]').forEach(b => b.addEventListener('click', async () => {
        const v = b.dataset.taglia ? parseFloat(b.dataset.taglia) : null;
        if (await UI.salva(dd => G.Mod.diametroPianta(dd, pid, v), 'Taglia aggiornata')) { ridisegna(); apriPianta(pid); }
      }));
      el.querySelector('#btn-scheda').addEventListener('click', () => { UI.chiudiFoglio(); location.hash = '#scheda/' + s.id; });
      el.querySelector('#btn-sposta').addEventListener('click', () => iniziaSposta(pid));
      el.querySelector('#btn-diario').addEventListener('click', () => UI.dialogoDiario({ pianta_id: pid }));
    }, () => { selezione = null; ridisegna(); });
  }

  function apriZona(zid) {
    const d = G.Archivio.d;
    const z = Q.zona(d, zid);
    if (!z) return;
    const tipo = (TIPI_ZONA[z.tipo] || TIPI_ZONA.altro).label;
    const area = G.areaPoligono(z.punti);
    const piante = d.piante.filter(p => Q.zonaDi(d, p) === z);
    let h = `<h2>${esc(z.nome)}</h2><div class="piccolo">${esc(tipo)} · ${area.toFixed(1).replace('.', ',')} m²</div>`;
    if (z.note) h += `<p>${esc(z.note)}</p>`;
    if (piante.length) {
      h += `<div class="titolo-sez" style="font-size:16px">Piante (${piante.length})</div>`;
      h += piante.map(p => `<div class="spunta" data-p="${p.id}">${UI.iconaSpecie(Q.specie(d, p.specie_id), 28)}<span class="cresce">${esc(Q.nomePianta(d, p))}</span>›</div>`).join('');
    }
    UI.foglio(h, el => {
      el.querySelectorAll('[data-p]').forEach(r => r.addEventListener('click', () => { selezione = r.dataset.p; ridisegna(); apriPianta(r.dataset.p); }));
    }, () => { selezione = null; ridisegna(); });
  }

  // ---------------------------------------------------------- sposta pianta
  function iniziaSposta(pid) {
    const p = Q.pianta(G.Archivio.d, pid);
    UI.chiudiFoglio(true);
    selezione = pid;
    st.spostando = { pid, x: p.x, y: p.y, x0: p.x, y0: p.y };
    const barra = document.createElement('div');
    barra.className = 'mappa-avviso';
    barra.id = 'barra-sposta';
    barra.innerHTML = 'Trascina la pianta o tocca il punto nuovo ' +
      '<button class="btn piccolo-btn" id="sposta-ok" style="margin-left:6px;background:#fff;color:#e65100">Fine</button>' +
      '<button class="btn piccolo-btn" id="sposta-no" style="margin-left:4px;background:transparent">✕</button>';
    document.getElementById('contenuto').appendChild(barra);
    const chiudi = () => { st.spostando = null; barra.remove(); ridisegna(); };
    barra.querySelector('#sposta-no').addEventListener('click', chiudi);
    barra.querySelector('#sposta-ok').addEventListener('click', async () => {
      const { x, y, x0, y0 } = st.spostando;
      if (Math.abs(x - x0) < 0.005 && Math.abs(y - y0) < 0.005) { chiudi(); return; }
      const ok = await UI.salva(dd => G.Mod.spostaPianta(dd, pid, x, y), 'Pianta spostata');
      if (ok) chiudi();
    });
    ridisegna();
  }

  // ------------------------------------------------------------- render
  function render(main) {
    const d = G.Archivio.d;
    main.classList.add('piena');
    main.innerHTML =
      `<div id="mappa-box"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>` +
      `<div id="mappa-filtri"><div class="chips">` +
      `<button class="chip" id="mese-prec">‹</button><button class="chip on" id="mese-nome">${MESI_LUNGHI[st.mese - 1]}</button>` +
      `<button class="chip" id="mese-succ">›</button>` +
      Object.entries(FILTRI).map(([k, v]) => `<button class="chip${st.filtro === k ? ' on' : ''}" data-f="${k}">${v}</button>`).join('') +
      `<button class="chip${st.chiome ? ' on' : ''}" id="chiome">Chiome</button></div></div>` +
      `<div class="mappa-zoom"><button id="z-piu">+</button><button id="z-meno">−</button><button id="z-tutto">⤢</button></div>`;
    svgEl = main.querySelector('svg');
    const box = main.querySelector('#mappa-box');
    if (!st.vb) st.vb = vbIniziale(d);
    ridisegna();
    collegaGesti(box);
    const zoom = f => {
      const [x, y, w, h] = st.vb;
      st.vb = [x + w / 2 - w * f / 2, y + h / 2 - h * f / 2, w * f, h * f];
      ridisegna();
    };
    main.querySelector('#z-piu').onclick = () => zoom(0.7);
    main.querySelector('#z-meno').onclick = () => zoom(1 / 0.7);
    main.querySelector('#z-tutto').onclick = () => { st.vb = vbIniziale(d); ridisegna(); };
    const cambiaMese = k => { st.mese = (st.mese - 1 + k + 12) % 12 + 1; render(main); };
    main.querySelector('#mese-prec').onclick = () => cambiaMese(-1);
    main.querySelector('#mese-succ').onclick = () => cambiaMese(1);
    main.querySelector('#mese-nome').onclick = () => { st.mese = G.meseCorrente(); render(main); };
    main.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.filtro = b.dataset.f; render(main); });
    main.querySelector('#chiome').onclick = () => { st.chiome = !st.chiome; render(main); };
    if (st.spostando) st.spostando = null;
  }

  window.Mappa = { render, ridisegna, apriPianta, mostra(pid) { selezione = pid; } };
})();
