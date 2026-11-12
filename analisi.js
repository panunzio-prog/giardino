// Analisi e grafici (come nell'app del PC): ore di lavoro, calendario annuale, meteo periodo e storico,
// raccolti, tempo di lavoro nella scheda.
(function () {
  const G = window.Giardino;
  const { Q, TIPI_ATTIVITA, CATEGORIE, MESI, MESI_LUNGHI } = G;
  const GR = window.Grafici;
  const { COL } = GR;
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, dec = 1) => Number(v).toFixed(dec).replace('.', ',');
  const segno = (v, dec = 0) => (v >= 0 ? '+' : '') + num(v, dec);
  const COLORI_SPECIE = ['#2f6b3a', '#e9a23b', '#3b82c4', '#c0392b', '#8e44ad', '#16a085', '#d35400', '#7cb342', '#b9770e', '#5d6d7e'];
  const COLORI_ANNI = ['#c8d6c0', '#a3c49a', '#7aae72', '#4f8f4a', '#2f6b3a'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const sigla = tipo => { const t = TIPI_ATTIVITA[tipo] || TIPI_ATTIVITA.altro; return `<span class="sigla" style="background:${t.colore}">${t.sigla}</span>`; };

  function kpi(ico, lab, val, unita, extra, cls = '') {
    return `<div class="kpi ${cls}"><div class="kpi-ico">${ico}</div><div class="kpi-lab">${lab}</div>` +
      `<div><span class="kpi-val">${val}</span>${unita ? `<span class="kpi-unit">${unita}</span>` : ''}</div>` +
      (extra || '') + '</div>';
  }
  const spiegazione = t => `<div class="piccolo" style="margin:2px 0 6px">${t}</div>`;
  function grafico(id, titolo, altezza, extraTitolo = '') {
    return `<div class="card"><div class="tit-graf" id="t-${id}">${titolo}</div>${extraTitolo}<div class="graf" id="${id}" style="height:${altezza}px"></div></div>`;
  }

  // ========================================================== ORE DI LAVORO
  const ore = { tipi: [], cat: [], specie: [], colore: 'tipo' };

  function vistaOre(el) {
    const d = G.Archivio.d;
    const conPiante = Q.specieOrdinate(d).filter(s => Q.pianteDi(d, s.id).length);
    ore.specie = ore.specie.filter(id => conPiante.some(s => s.id === id));
    const chip = (attr, k, on, testo) => `<button class="chip${on ? ' on' : ''}" ${attr}="${k}">${testo}</button>`;
    let h = '<div class="chips">' + Object.entries(TIPI_ATTIVITA).map(([k, t]) => chip('data-ot', k, ore.tipi.includes(k), `${t.emoji} ${t.label}`)).join('') + '</div>' +
      '<div class="chips">' + Object.entries(CATEGORIE).map(([k, c]) => chip('data-oc', k, ore.cat.includes(k), c.label)).join('') + '</div>' +
      `<div class="chips"><button class="chip${ore.specie.length ? ' on' : ''}" id="o-piante">🌳 Piante: ${ore.specie.length ? ore.specie.length + ' scelte' : 'tutte'}</button>` +
      '<span class="piccolo" style="align-self:center;margin-left:4px">Colora per</span>' +
      [['tipo', 'tipo'], ['categoria', 'categoria'], ['specie', 'pianta']].map(([k, l]) => chip('data-ocol', k, ore.colore === k, l)).join('') + '</div>' +
      spiegazione('Stima: minuti per pianta × numero di piante sulla mappa × frequenza. I minuti si cambiano nella scheda di ogni specie.');

    const om = Q.orePerMese(d, ore.tipi, ore.cat, ore.specie);
    const mesi = new Array(12).fill(0);
    Object.values(om).forEach(r => r.forEach((v, i) => { mesi[i] += v; }));
    const tot = mesi.reduce((t, v) => t + v, 0);
    if (!tot) {
      el.innerHTML = h + '<div class="vuoto">Nessun lavoro per i filtri scelti (contano solo le piante sulla mappa).</div>';
    } else {
      const m = G.meseCorrente();
      const picco = mesi.indexOf(Math.max(...mesi));
      h += '<div class="kpi-griglia">' +
        kpi('⏱', 'Totale anno', G.fmtOre(tot), '', `<div class="piccolo">≈ ${num(tot / 52)} h a settimana</div>`) +
        kpi('📅', `${MESI_LUNGHI[m - 1]} (questo mese)`, G.fmtOre(mesi[m - 1]), '') +
        kpi('🔥', 'Mese più impegnativo', G.fmtOre(mesi[picco]), '', `<div class="piccolo">${MESI_LUNGHI[picco]}</div>`) + '</div>';
      h += grafico('g-ore', 'Ore di lavoro per mese', 340);

      // tabella specie × mese
      const perSpecie = {};
      for (const [k, r] of Object.entries(om)) {
        const sid = k.split('|')[0];
        const g = perSpecie[sid] = perSpecie[sid] || new Array(12).fill(0);
        r.forEach((v, i) => { g[i] += v; });
      }
      const somma = r => r.reduce((t, v) => t + v, 0);
      const righe = Object.keys(perSpecie).sort((a, b) => somma(perSpecie[b]) - somma(perSpecie[a])).map(sid => {
        const s = Q.specie(d, sid);
        return `<tr><td class="nome"><a href="#scheda/${sid}">${UI.iconaSpecie(s, 18)} ${esc(s.nome)}</a> <small>×${Q.pianteDi(d, sid).length}</small></td>` +
          perSpecie[sid].map(v => `<td>${v >= 0.05 ? num(v) : '–'}</td>`).join('') + `<td><b>${num(somma(perSpecie[sid]))}</b></td></tr>`;
      });
      righe.push('<tr class="totale"><td class="nome">Totale</td>' + mesi.map(v => `<td>${num(v)}</td>`).join('') + `<td>${num(tot)}</td></tr>`);
      h += '<div class="card"><div class="tit-graf">Ore per pianta e per mese</div><div class="tab-scorri"><table class="tab-mesi"><tr><th class="nome">Specie</th>' +
        MESI.map(x => `<th>${x}</th>`).join('') + '<th>Anno</th></tr>' + righe.join('') + '</table></div></div>';
      el.innerHTML = h;

      // serie impilate secondo "Colora per"
      const gruppi = {};
      for (const [k, r] of Object.entries(om)) {
        const [sid, tipo] = k.split('|');
        const s = Q.specie(d, sid);
        const g = ore.colore === 'tipo' ? tipo : ore.colore === 'categoria' ? (s.categoria || 'altro') : sid;
        const x = gruppi[g] = gruppi[g] || new Array(12).fill(0);
        r.forEach((v, i) => { x[i] += v; });
      }
      let chiavi, nome, colore;
      if (ore.colore === 'tipo') {
        chiavi = Object.keys(TIPI_ATTIVITA).filter(k => gruppi[k]);
        nome = k => TIPI_ATTIVITA[k].label; colore = k => TIPI_ATTIVITA[k].colore;
      } else if (ore.colore === 'categoria') {
        chiavi = [...Object.keys(CATEGORIE).filter(k => gruppi[k]), ...Object.keys(gruppi).filter(k => !CATEGORIE[k])];
        nome = k => (CATEGORIE[k] || CATEGORIE.altro).label; colore = k => (CATEGORIE[k] || CATEGORIE.altro).colore;
      } else {
        let ord = Object.keys(gruppi).sort((a, b) => somma(gruppi[b]) - somma(gruppi[a]));
        if (ord.length > 10) {
          const altre = new Array(12).fill(0);
          ord.slice(9).forEach(k => { gruppi[k].forEach((v, i) => { altre[i] += v; }); delete gruppi[k]; });
          gruppi._altre = altre;
          ord = [...ord.slice(0, 9), '_altre'];
        }
        chiavi = ord;
        nome = k => (k === '_altre' ? 'Altre piante' : Q.specie(d, k).nome);
        colore = k => (k === '_altre' ? '#9aa79c' : COLORI_SPECIE[chiavi.indexOf(k) % COLORI_SPECIE.length]);
      }
      GR.disegna(el.querySelector('#g-ore'), {
        tooltip: GR.tooltip({ axisPointer: { type: 'shadow' }, valueFormatter: v => (v ? num(v) + ' h' : '–') }),
        legend: GR.legenda(chiavi.map(nome)),
        grid: { left: 34, right: 6, top: 36, bottom: 22 },
        xAxis: { type: 'category', data: MESI.map(x => x.charAt(0).toUpperCase()), axisLabel: { color: COL.GRIGIO_ASSI, interval: 0, fontSize: 10 } },
        yAxis: GR.asseY('ore'),
        series: chiavi.map(k => ({ name: nome(k), type: 'bar', stack: 'ore', barMaxWidth: 26, itemStyle: { color: colore(k) },
          emphasis: { focus: 'series' }, data: gruppi[k].map(v => Math.round(v * 100) / 100 || null) }))
          .concat([{ name: 'Totale', type: 'bar', stack: 'ore', silent: true, tooltip: { show: false }, itemStyle: { color: 'transparent' },
            data: new Array(12).fill(0), label: { show: true, position: 'top', color: COL.GRIGIO_ASSI, fontSize: 9,
              formatter: p => (mesi[p.dataIndex] >= 0.05 ? num(mesi[p.dataIndex], mesi[p.dataIndex] >= 10 ? 0 : 1) : '') } }]),
      });
    }
    const ridisegna = () => vistaOre(el);
    const alterna = (lista, k) => (lista.includes(k) ? lista.filter(x => x !== k) : [...lista, k]);
    el.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { ore.tipi = alterna(ore.tipi, b.dataset.ot); ridisegna(); });
    el.querySelectorAll('[data-oc]').forEach(b => b.onclick = () => { ore.cat = alterna(ore.cat, b.dataset.oc); ridisegna(); });
    el.querySelectorAll('[data-ocol]').forEach(b => b.onclick = () => { ore.colore = b.dataset.ocol; ridisegna(); });
    el.querySelector('#o-piante').onclick = () => {
      const html = '<h2>Piante da contare</h2><div class="piccolo">Nessuna spunta = tutte</div>' +
        conPiante.map(s => `<label class="spunta"><input type="checkbox" value="${s.id}" ${ore.specie.includes(s.id) ? 'checked' : ''}>` +
          `${UI.iconaSpecie(s, 24)}<span class="cresce">${esc(s.nome)}</span></label>`).join('') +
        '<div class="riga" style="margin-top:10px"><button class="btn leggero cresce" id="o-nessuna">Tutte</button><button class="btn cresce" id="o-ok">Mostra</button></div>';
      UI.foglio(html, f => {
        f.querySelector('#o-nessuna').onclick = () => { ore.specie = []; UI.chiudiFoglio(true); ridisegna(); };
        f.querySelector('#o-ok').onclick = () => {
          ore.specie = [...f.querySelectorAll('input:checked')].map(i => i.value);
          UI.chiudiFoglio(true); ridisegna();
        };
      });
    };
  }

  // ======================================================= CALENDARIO ANNUALE
  function vistaCalendario(el) {
    const d = G.Archivio.d;
    const m = G.meseCorrente();
    const leg = Object.keys(TIPI_ATTIVITA).map(k => `${sigla(k)} ${TIPI_ATTIVITA[k].label}`).join(' ') +
      ' <span class="fiore-leg">fioritura</span>';
    const righe = Q.specieOrdinate(d).map(s => {
      const n = Q.pianteDi(d, s.id).length;
      const ordine = Object.keys(TIPI_ATTIVITA);
      const celle = [];
      for (let i = 1; i <= 12; i++) {
        const tipi = Q.tipiSpecieNelMese(s, i).sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
        const cls = [i === m ? 'oggi' : '', (s.fioritura || []).includes(i) ? 'fiore' : ''].join(' ').trim();
        celle.push(`<td class="${cls}">${tipi.map(sigla).join('')}</td>`);
      }
      return `<tr><td class="nome"><a href="#scheda/${s.id}">${UI.iconaSpecie(s, 16)} ${esc(s.nome)}</a>${n ? ` <small>×${n}</small>` : ''}</td>${celle.join('')}</tr>`;
    });
    el.innerHTML = `<div class="piccolo legenda-cal">${leg}</div>` +
      '<div class="card" style="padding:4px"><div class="tab-scorri alto"><table class="tab-anno"><tr><th class="nome">Specie</th>' +
      MESI.map((x, i) => `<th class="${i + 1 === m ? 'oggi' : ''}">${x}</th>`).join('') + '</tr>' + righe.join('') + '</table></div></div>';
  }

  // ===================================================================== METEO
  const MS = window.MeteoStorico;
  const PASSI = { giorno: 'Giorno', settimana: 'Sett.', quindicina: '2 sett.', mese: 'Mese' };
  const ieriISO = () => MS.piu(G.oggi(), -1);
  const fmtG = s => `${+s.slice(8, 10)} ${MESI[+s.slice(5, 7) - 1]}`;
  const r2 = v => (v == null ? null : Math.round(v * 100) / 100);
  const periodo = { da: null, a: null, passo: 'giorno' };
  const storico = { anno: '12m', prec: true, media: true, passo_mm: 'settimana', passo_kwh: 'settimana', passo_t: 'settimana' };

  function delta(valore, media) {
    if (valore == null || !media) return '';
    const p = (valore - media) / media * 100;
    return `<span class="${p >= 0 ? 'delta-su' : 'delta-giu'}">${p >= 0 ? '+' : ''}${p.toFixed(0)}%</span> rispetto alla media`;
  }
  function deltaBreve(v, m) {
    if (v == null || !m) return '';
    const p = (v - m) / m * 100;
    return `<span class="${p >= 0 ? 'delta-su' : 'delta-giu'}">${p >= 0 ? '+' : ''}${p.toFixed(0)}%</span>`;
  }
  function deltaGradi(v, m) {
    if (v == null || m == null) return '';
    const x = v - m;
    if (Math.abs(x) < 0.05) return '0,0°';
    return `<span class="${x > 0 ? 'delta-caldo' : 'delta-freddo'}">${segno(x, 1)}°</span>`;
  }
  function deltaTemp(t, mt) {
    if (!mt) return '';
    return `${deltaGradi((t.tmin_medio + t.tmax_medio) / 2, (mt.tmin + mt.tmax) / 2)} rispetto alla media ` +
      `<span class="piccolo">(${num(mt.tmax)}° / ${num(mt.tmin)}°)</span>`;
  }
  function etichetta(b, passo) {
    if (passo === 'giorno') return fmtG(b.inizio);
    if (passo === 'mese') return `${MESI[+b.inizio.slice(5, 7) - 1]} ${b.inizio.slice(2, 4)}`;
    return `${fmtG(b.inizio)}–${fmtG(b.fine)}`;
  }

  function opzioniTempo(serie, giorni) {
    return {
      tooltip: GR.tooltip({ valueFormatter: GR.fmt1 }),
      legend: GR.legenda(serie.filter(x => !x.name.startsWith('_')).map(x => x.name)),
      grid: { left: 40, right: 12, top: 40, bottom: 24 },
      xAxis: GR.asseTempo(giorni), yAxis: GR.asseY(''), series: serie,
    };
  }
  const TOOLTIP_T = () => GR.tooltip({ formatter: ps => {
    const f = v => (v == null ? '–' : num(v) + '°');
    let h = ps.length ? ps[0].axisValueLabel : '';
    ps.filter(p => !p.seriesName.startsWith('_')).forEach(p => {
      h += '<br>' + p.marker + p.seriesName + ': <b>' + f(Array.isArray(p.value) ? p.value[1] : p.value) + '</b>';
    });
    return h;
  } });

  function opzioniTemperature(da, a, passo, prec, media) {
    const b = MS.blocchi(da, a, passo);
    const x = b.map(v => v.centro);
    const liscia = passo !== 'giorno';
    const punti = valori => x.map((xi, i) => [xi, r2(valori[i])]);
    const linea = (nome, valori, colore, extra) => Object.assign({ name: nome, type: 'line', smooth: liscia, showSymbol: false,
      color: colore, data: punti(valori) }, extra || {});
    const diffT = b.map(v => (v.tmin == null || v.tmax == null ? null : v.tmax - v.tmin));
    const serie = [
      linea('_base', b.map(v => v.tmin), COL.TMIN, { stack: 'fascia', lineStyle: { opacity: 0 }, silent: true }),
      linea('_fascia', diffT, COL.TMAX, { stack: 'fascia', lineStyle: { opacity: 0 }, silent: true, areaStyle: { color: COL.TMAX, opacity: 0.08 } }),
      linea('Massima', b.map(v => v.tmax), COL.TMAX, { lineStyle: { width: 2.5 } }),
      linea('Minima', b.map(v => v.tmin), COL.TMIN, { lineStyle: { width: 2.5 } }),
    ];
    if (prec) {
      const bp = MS.blocchi(MS.annoPrima(da), MS.annoPrima(a), passo);
      serie.push(linea('Anno prec. max', bp.map(v => v.tmax), COL.PREC, { lineStyle: { width: 1.5, opacity: 0.85 } }),
        linea('Anno prec. min', bp.map(v => v.tmin), COL.PREC, { lineStyle: { width: 1.5, opacity: 0.85, type: 'dotted' } }));
    }
    if (media) {
      const medie = b.map(v => MS.mediaTemp(v.inizio, v.fine));
      if (medie.every(Boolean)) {
        serie.push(linea('Media 10 anni max', medie.map(m => m.tmax), COL.MEDIA, { lineStyle: { width: 2, type: 'dashed' } }),
          linea('Media 10 anni min', medie.map(m => m.tmin), COL.MEDIA, { lineStyle: { width: 2, type: 'dashed', opacity: 0.7 } }));
      }
    }
    const opz = opzioniTempo(serie, MS.diff(a, da));
    opz.tooltip = TOOLTIP_T();
    opz.yAxis = Object.assign(GR.asseY('°C'), { scale: true });
    opz.grid.top = 52;
    return opz;
  }

  const CUMULATE = {
    mm: ['Pioggia cumulata', COL.PIOGGIA, 'mm'], kwh: ['Energia solare cumulata', COL.SOLE, 'kWh/m²'],
    bilancio: ['Bilancio idrico cumulato', COL.ACQUA, 'mm'], gdd: ['Gradi-giorno cumulati (base 10 °C)', COL.GDD, '°C·giorno'],
  };
  function disegnaCumulata(el, id, da, a, conPrec, chiave, st) {
    const [nome, colore, unita] = CUMULATE[chiave];
    const cum = MS.cumulata(da, a, chiave);
    const x = cum.map(c => c[0]);
    const serie = [{ name: nome.split(' (')[0], type: 'line', showSymbol: false, color: colore,
      data: cum.map(c => [c[0], r2(c[1])]), lineStyle: { width: 3 }, areaStyle: { opacity: 0.15 } }];
    if (chiave === 'bilancio') {
      serie[0].markLine = { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: COL.GRIGIO_ASSI, type: 'solid' }, label: { show: false } };
    }
    if (conPrec && st.prec) {
      const prec = MS.cumulata(MS.annoPrima(da), MS.annoPrima(a), chiave);
      serie.push({ name: 'Anno precedente', type: 'line', showSymbol: false, color: COL.PREC,
        data: x.map((xi, i) => [xi, r2(prec[i] ? prec[i][1] : null)]), lineStyle: { width: 2 } });
    }
    const med = MS.cumulataMedia(da, a, chiave);
    if (med && (st.media || !conPrec)) {
      serie.push({ name: 'Media 10 anni', type: 'line', showSymbol: false, color: COL.MEDIA,
        data: med.map(m => [m[0], r2(m[1])]), lineStyle: { width: 2, type: 'dashed' } });
    }
    const ultimo = [...cum].reverse().find(c => c[1] != null);
    let testo = nome;
    if (ultimo) {
      const u = ultimo[1];
      const fin = med ? med[med.length - 1][1] : null;
      testo += chiave === 'bilancio' ? ` · ${segno(u)} ${unita}` : ` · ${num(u, 0)} ${unita}`;
      if (med && chiave === 'gdd') testo += ` <span class="piccolo">(${segno(u - fin)} rispetto alla media di ${num(fin, 0)})</span>`;
      else if (med && chiave !== 'bilancio' && fin) testo += ` <span class="piccolo">(${deltaBreve(u, fin)} rispetto alla media di ${num(fin, 0)} ${unita})</span>`;
      else if (med && chiave === 'bilancio') testo += ` <span class="piccolo">(media ${segno(fin)} mm)</span>`;
    }
    el.querySelector('#t-' + id).innerHTML = testo;
    GR.disegna(el.querySelector('#' + id), opzioniTempo(serie, MS.diff(a, da)));
  }

  async function conMeteo(el, disegna) {
    if (!MS.c) el.innerHTML = '<div class="vuoto">Carico lo storico meteo da Dropbox…</div>';
    const hash = location.hash;
    try { await MS.pronto(); } catch (e) {
      if (location.hash === hash) {
        el.innerHTML = '<div class="vuoto">Storico meteo non disponibile.<br><span class="piccolo">Serve il file ' +
          `${esc(CONFIG.FILE_METEO)} (lo crea l'app del PC aprendo la pagina Meteo) e la connessione.</span></div>`;
      }
      return;
    }
    if (location.hash !== hash) return;
    disegna();
  }

  // ------------------------------------------------------------ periodo
  function vistaPeriodo(el) {
    conMeteo(el, () => disegnaPeriodo(el));
  }
  function disegnaPeriodo(el) {
    const ieri = ieriISO(), oggi = G.oggi();
    if (!periodo.da) { periodo.da = MS.piu(ieri, -6); periodo.a = ieri; }
    const { da, a } = periodo;
    const rapidi = [
      ['Ultimi 7 giorni', MS.piu(ieri, -6), ieri], ['Ultimi 30 giorni', MS.piu(ieri, -29), ieri],
      [MESI_LUNGHI[+oggi.slice(5, 7) - 1], oggi.slice(0, 8) + '01', oggi], [`Da inizio ${oggi.slice(0, 4)}`, oggi.slice(0, 5) + '01-01', oggi],
      ['Ultimi 12 mesi', MS.piu(ieri, -364), ieri],
    ];
    let h = '<div class="card"><div class="riga"><label class="campo cresce" style="margin:0">Dal<input type="date" id="p-da" value="' + da + '"></label>' +
      '<label class="campo cresce" style="margin:0">Al<input type="date" id="p-a" value="' + a + '"></label></div>' +
      '<div class="chips" style="margin-top:6px">' + rapidi.map(([l, x, y], i) => `<button class="chip${x === da && y === a ? ' on' : ''}" data-r="${i}">${l}</button>`).join('') + '</div></div>';
    const t = MS.totali(da, a);
    if (!t.giorni) {
      el.innerHTML = h + '<div class="vuoto">Nessun dato per il periodo scelto.</div>';
    } else {
      const med = MS.mediaPeriodo(da, a);
      const area = Q.areaConfine(G.Archivio.d);
      h += '<div class="kpi-griglia">';
      h += kpi('🌧️', 'Pioggia totale', num(t.mm), 'mm = L/m²', `<div class="piccolo">${delta(t.mm, med && med[0])}</div>` +
        (area ? `<div class="piccolo">≈ ${Math.round(t.mm * area).toLocaleString('it-IT')} litri sul lotto (${Math.round(area)} m²)</div>` : ''), 'pioggia');
      h += kpi('☀️', 'Energia solare', num(t.kwh), 'kWh/m²', `<div class="piccolo">${delta(t.kwh, med && med[1])}</div>` +
        `<div class="piccolo">media ${num(t.kwh_medio, 2)} kWh/m² al giorno</div>`, 'sole');
      h += kpi('☔', 'Giorni di pioggia', t.giorni_pioggia, `su ${t.giorni} (≥ 1 mm)`,
        `<div class="piccolo">più piovoso: ${fmtG(t.max_pioggia[0])} (${num(t.max_pioggia[1])} mm)</div>` +
        `<div class="piccolo">più soleggiato: ${fmtG(t.max_sole[0])} (${num(t.max_sole[1], 2)} kWh/m²)</div>`);
      if (t.bilancio != null) {
        const mb = MS.cumulataMedia(da, a, 'bilancio');
        h += kpi('💧', 'Bilancio idrico', segno(t.bilancio, 1), 'mm', `<div class="piccolo">pioggia ${num(t.mm)} − evaporazione ${num(t.et0)} mm</div>` +
          (mb ? `<div class="piccolo">di solito ${segno(mb[mb.length - 1][1], 1)} mm in questo periodo</div>` : ''), 'acqua');
      }
      if (t.tmin_medio != null) {
        const mt = MS.mediaTemp(da, a);
        const [fd, fv] = t.t_min_assoluta, [cd, cv] = t.t_max_assoluta;
        h += kpi('🌡️', 'Temperature medie', `${num(t.tmax_medio)}°`, 'max',
          ` <span class="kpi-val" style="font-size:22px">${num(t.tmin_medio)}°</span><span class="kpi-unit">min</span>` +
          `<div class="piccolo">${deltaTemp(t, mt)}</div><div class="piccolo">più fredda ${num(fv)}° il ${fmtG(fd)} · più calda ${num(cv)}° il ${fmtG(cd)}</div>` +
          `<div class="piccolo">❄️ ${t.giorni_gelo} giorni di gelo · 🔥 ${t.giorni_caldo} giorni ≥ 30°${mt ? ` (di solito ${num(mt.gelo, 0)} e ${num(mt.caldo, 0)})` : ''}</div>`, 'temp');
      }
      h += '</div>';
      if (!med) h += spiegazione('Il confronto con la media degli ultimi 10 anni comparirà quando il PC avrà scaricato lo storico.');
      if (a >= oggi) h += spiegazione('ℹ️ Il valore di oggi è parziale.');
      h += grafico('g-giorni', 'Pioggia e sole', 300, '<div class="chips">' + ['giorno', 'settimana', 'mese'].map(k =>
        `<button class="chip${periodo.passo === k ? ' on' : ''}" data-passo="${k}">${PASSI[k]}</button>`).join('') + '</div>');
      h += grafico('g-temp-p', '🌡️ Temperature minime e massime (°C)', 280);
      h += grafico('g-cum-p', 'Pioggia cumulata', 240) + grafico('g-cum-ps', 'Energia solare cumulata', 240) + grafico('g-cum-pg', 'Gradi-giorno cumulati', 240);
      el.innerHTML = h;

      const b = MS.blocchi(da, a, periodo.passo);
      const molte = b.length > 31;
      GR.disegna(el.querySelector('#g-giorni'), {
        tooltip: GR.tooltip({ valueFormatter: GR.fmt1 }),
        legend: GR.legenda(['Pioggia (mm)', 'Sole (kWh/m²)']),
        grid: { left: 36, right: 36, top: 40, bottom: molte ? 50 : 24 },
        xAxis: { type: 'category', data: b.map(x => etichetta(x, periodo.passo)), axisLabel: { color: COL.GRIGIO_ASSI, fontSize: 10 }, axisLine: { lineStyle: { color: COL.LINEE } } },
        yAxis: [GR.asseY('mm'), GR.asseY('kWh/m²', true)],
        dataZoom: molte ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 6 }] : [],
        series: [
          { name: 'Pioggia (mm)', type: 'bar', data: b.map(x => r2(x.mm)), barMaxWidth: 20, itemStyle: { color: COL.PIOGGIA, borderRadius: [4, 4, 0, 0] } },
          { name: 'Sole (kWh/m²)', type: 'bar', yAxisIndex: 1, data: b.map(x => r2(x.kwh)), barMaxWidth: 20, itemStyle: { color: COL.SOLE, borderRadius: [4, 4, 0, 0], opacity: 0.85 } },
        ],
      });
      GR.disegna(el.querySelector('#g-temp-p'), opzioniTemperature(da, a, periodo.passo, false, true));
      const st = { prec: false, media: true };
      disegnaCumulata(el, 'g-cum-p', da, a, false, 'mm', st);
      disegnaCumulata(el, 'g-cum-ps', da, a, false, 'kwh', st);
      disegnaCumulata(el, 'g-cum-pg', da, a, false, 'gdd', st);
    }
    const ridisegna = () => { const y = window.scrollY; disegnaPeriodo(el); window.scrollTo(0, y); };
    const imposta = (x, y) => {
      if (!x || !y) return;
      if (x > y) [x, y] = [y, x];
      if (y > oggi) y = oggi;
      periodo.da = x; periodo.a = y;
      if (MS.diff(y, x) > 92 && periodo.passo === 'giorno') periodo.passo = 'settimana';
      ridisegna();
    };
    el.querySelectorAll('[data-r]').forEach(bt => bt.onclick = () => { const r = rapidi[+bt.dataset.r]; imposta(r[1], r[2]); });
    el.querySelector('#p-da').onchange = e => imposta(e.target.value, periodo.a);
    el.querySelector('#p-a').onchange = e => imposta(periodo.da, e.target.value);
    el.querySelectorAll('[data-passo]').forEach(bt => bt.onclick = () => { periodo.passo = bt.dataset.passo; ridisegna(); });
  }

  // ------------------------------------------------------------ storico
  function vistaStorico(el) {
    conMeteo(el, () => disegnaStorico(el));
  }
  function disegnaStorico(el) {
    const st = storico;
    const [da, a] = MS.periodoStorico(st.anno);
    const eti = st.anno === '12m' ? 'Ultimi 12 mesi' : String(st.anno);
    const scelte = [['12m', 'Ultimi 12 mesi'], ...MS.anniDisponibili().map(x => [String(x), String(x)])];
    const passi = chiave => '<div class="chips">' + Object.entries(PASSI).map(([k, l]) =>
      `<button class="chip${st[chiave] === k ? ' on' : ''}" data-sp="${chiave}|${k}">${l}</button>`).join('') + '</div>';
    let h = '<div class="card"><div class="chips">' + scelte.map(([k, l]) => `<button class="chip${String(st.anno) === k ? ' on' : ''}" data-anno="${k}">${l}</button>`).join('') + '</div>' +
      `<div class="chips"><button class="chip${st.prec ? ' on' : ''}" id="s-prec">Confronta con l'anno precedente</button>` +
      `<button class="chip${st.media ? ' on' : ''}" id="s-media">Media ultimi 10 anni</button></div></div>`;
    h += grafico('g-pioggia', '🌧️ Pioggia (mm = L/m²)', 260, passi('passo_mm'));
    h += grafico('g-cum', 'Pioggia cumulata', 260);
    h += grafico('g-sole', '☀️ Energia solare (kWh/m²)', 260, passi('passo_kwh'));
    h += grafico('g-cum-s', 'Energia solare cumulata', 260);
    h += grafico('g-temp', '🌡️ Temperature minime e massime (°C)', 290, passi('passo_t'));
    h += grafico('g-gdd', 'Gradi-giorno cumulati', 260, spiegazione('Somma del calore utile alle piante: ogni giorno conta la temperatura media oltre i 10 °C. ' +
      'Sopra la media la stagione è in anticipo (fioriture, raccolti, parassiti), sotto è in ritardo.'));
    h += grafico('g-bil', 'Bilancio idrico cumulato', 260, spiegazione('Pioggia meno evaporazione del terreno e delle piante (ET₀): quando la curva scende ' +
      'il giardino perde acqua, quando sale ne accumula.'));
    h += '<div class="card"><div class="tit-graf">Totali mensili</div><div class="tab-scorri" id="s-tabella"></div></div>';
    el.innerHTML = h;

    for (const [chiave, colore, id, passo] of [['mm', COL.PIOGGIA, 'g-pioggia', st.passo_mm], ['kwh', COL.SOLE, 'g-sole', st.passo_kwh]]) {
      const b = MS.blocchi(da, a, passo);
      const x = b.map(v => v.centro);
      const punti = valori => x.map((xi, i) => [xi, r2(valori[i])]);
      const serie = [{ name: eti, type: 'bar', data: punti(b.map(v => v[chiave])), barMaxWidth: 24, barMinWidth: 1,
        itemStyle: { color: colore, borderRadius: [3, 3, 0, 0] } }];
      if (st.prec) {
        const p = MS.blocchi(MS.annoPrima(da), MS.annoPrima(a), passo);
        serie.push({ name: 'Anno precedente', type: 'line', smooth: passo !== 'giorno', showSymbol: false,
          data: punti(p.map(q => q[chiave])), color: COL.PREC, lineStyle: { width: 2, opacity: 0.85 } });
      }
      if (st.media) {
        const medie = b.map(v => MS.mediaPeriodo(v.inizio, v.fine));
        if (medie.every(Boolean)) {
          serie.push({ name: 'Media 10 anni', type: 'line', smooth: passo !== 'giorno', showSymbol: false,
            data: punti(medie.map(m => m[chiave === 'mm' ? 0 : 1])), color: COL.MEDIA, lineStyle: { width: 2, type: 'dashed' } });
        }
      }
      GR.disegna(el.querySelector('#' + id), opzioniTempo(serie, MS.diff(a, da)));
    }
    disegnaCumulata(el, 'g-cum', da, a, true, 'mm', st);
    disegnaCumulata(el, 'g-cum-s', da, a, true, 'kwh', st);
    disegnaCumulata(el, 'g-bil', da, a, true, 'bilancio', st);
    disegnaCumulata(el, 'g-gdd', da, a, true, 'gdd', st);
    GR.disegna(el.querySelector('#g-temp'), opzioniTemperature(da, a, st.passo_t, st.prec, st.media));
    el.querySelector('#s-tabella').innerHTML = tabellaMensile(da, a);

    const ridisegna = () => { const y = window.scrollY; disegnaStorico(el); window.scrollTo(0, y); };
    el.querySelectorAll('[data-anno]').forEach(b => b.onclick = () => { st.anno = b.dataset.anno; ridisegna(); });
    el.querySelector('#s-prec').onclick = () => { st.prec = !st.prec; ridisegna(); };
    el.querySelector('#s-media').onclick = () => { st.media = !st.media; ridisegna(); };
    el.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.sp.split('|'); st[k] = v; ridisegna(); });
  }

  function celleTemp(tmin, tmax, mtmin, mtmax, gelo, caldo, mgelo, mcaldo) {
    if (tmin == null) return '<td></td>'.repeat(5);
    const dl = deltaGradi((tmin + tmax) / 2, mtmin == null ? null : (mtmin + mtmax) / 2);
    const conta = (n, m) => `${n}` + (m == null ? '' : ` <span class="piccolo">(${num(m, 0)})</span>`);
    return `<td>${num(tmin)}°</td><td>${num(tmax)}°</td><td>${dl}</td><td>${conta(gelo, mgelo)}</td><td>${conta(caldo, mcaldo)}</td>`;
  }
  function tabellaMensile(da, a) {
    const righe = [];
    const tot = { mm: 0, kwh: 0, mmm: 0, mkwh: 0, gp: 0, gelo: 0, caldo: 0, mgelo: 0, mcaldo: 0 };
    const tminL = [], tmaxL = [], mtminL = [], mtmaxL = [];
    const n0 = v => (v == null ? '' : num(v, 0));
    for (const r of MS.mesi(da, a)) {
      if (r.mm == null) continue;
      tot.mm += r.mm; tot.kwh += r.kwh; tot.gp += r.giorni_pioggia || 0; tot.mmm += r.media_mm || 0; tot.mkwh += r.media_kwh || 0;
      if (r.tmin != null) {
        tminL.push(r.tmin); tmaxL.push(r.tmax); tot.gelo += r.gelo; tot.caldo += r.caldo;
        if (r.media_tmin != null) { mtminL.push(r.media_tmin); mtmaxL.push(r.media_tmax); tot.mgelo += r.media_gelo; tot.mcaldo += r.media_caldo; }
      }
      const nome = `${MESI[+r.mese.slice(5, 7) - 1]} ${r.mese.slice(2, 4)}${r.parziale ? ' *' : ''}`;
      righe.push(`<tr><td class="nome">${nome}</td><td>${n0(r.mm)}</td><td>${r.giorni_pioggia}</td><td>${n0(r.media_mm)}</td><td>${deltaBreve(r.mm, r.media_mm)}</td>` +
        `<td>${n0(r.kwh)}</td><td>${n0(r.media_kwh)}</td><td>${deltaBreve(r.kwh, r.media_kwh)}</td>` +
        celleTemp(r.tmin, r.tmax, r.media_tmin, r.media_tmax, r.gelo, r.caldo, r.media_gelo, r.media_caldo) + '</tr>');
    }
    const med = xs => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
    const ok = mtminL.length > 0 && mtminL.length === tminL.length;
    righe.push(`<tr class="totale"><td class="nome">Totale</td><td>${n0(tot.mm)}</td><td>${tot.gp}</td><td>${n0(tot.mmm)}</td><td>${deltaBreve(tot.mm, tot.mmm)}</td>` +
      `<td>${n0(tot.kwh)}</td><td>${n0(tot.mkwh)}</td><td>${deltaBreve(tot.kwh, tot.mkwh)}</td>` +
      celleTemp(med(tminL), med(tmaxL), ok ? med(mtminL) : null, ok ? med(mtmaxL) : null, tot.gelo, tot.caldo, ok ? tot.mgelo : null, ok ? tot.mcaldo : null) + '</tr>');
    return '<table class="tab-mesi"><tr><th class="nome">Mese</th><th>🌧 mm</th><th>giorni ≥1 mm</th><th>media mm</th><th>Δ</th>' +
      '<th>☀ kWh/m²</th><th>media</th><th>Δ</th><th>🌡 min</th><th>max</th><th>Δ °C</th><th>❄️ gelo</th><th>🔥 ≥30°</th></tr>' +
      righe.join('') + '</table>' +
      '<div class="piccolo" style="margin-top:6px">* mese parziale (la media è sugli stessi giorni). Media = ultimi 10 anni completi. ' +
      'Δ °C = scarto della temperatura media dalla norma; gelo = minima ≤ 0°, ≥30° = massima ≥ 30°; tra parentesi il numero medio.</div>';
  }

  // ================================================================ RACCOLTI
  function raccolti(el) {
    const d = G.Archivio.d;
    const dati = Q.raccolti(d);
    const anno = G.annoCorrente();
    const anni = [anno - 4, anno - 3, anno - 2, anno - 1, anno];
    const specie = Object.keys(dati).filter(sid => Q.specie(d, sid));
    if (!specie.length) {
      el.innerHTML = '<div class="vuoto">🧺<br>Nessun raccolto pesato finora.<br><span class="piccolo">Registra una raccolta con i kg: la ritrovi qui, anno per anno.</span></div>';
      return;
    }
    const somma = sid => Object.values(dati[sid]).reduce((t, v) => t + v, 0);
    specie.sort((x, y) => somma(y) - somma(x));
    const nome = sid => Q.specie(d, sid).nome;
    const totAnno = {};
    anni.forEach(a => { totAnno[a] = specie.reduce((t, sid) => t + (dati[sid][a] || 0), 0); });
    let h = '<div class="kpi-griglia">' + anni.slice(-3).reverse().map(a => {
      const prima = specie.reduce((t, sid) => t + (dati[sid][a - 1] || 0), 0);
      let dl = '';
      if (prima) { const pc = (totAnno[a] - prima) / prima * 100; dl = `<div class="piccolo"><span class="${pc >= 0 ? 'delta-su' : 'delta-giu'}">${pc >= 0 ? '+' : ''}${pc.toFixed(0)}%</span> sul ${a - 1}</div>`; }
      return kpi('🧺', `Raccolto ${a}`, num(totAnno[a]), 'kg', dl);
    }).join('') + '</div>';
    h += grafico('g-racc', 'kg per specie', Math.max(220, 30 * specie.length + 70));
    const righe = specie.map(sid => `<tr><td class="nome">${UI.iconaSpecie(Q.specie(d, sid), 18)} ${esc(nome(sid))}</td>` +
      anni.map(a => `<td>${dati[sid][a] ? num(dati[sid][a]) : '–'}</td>`).join('') + `<td><b>${num(somma(sid))}</b></td></tr>`);
    righe.push('<tr class="totale"><td class="nome">Totale</td>' + anni.map(a => `<td>${num(totAnno[a])}</td>`).join('') +
      `<td>${num(specie.reduce((t, sid) => t + somma(sid), 0))}</td></tr>`);
    h += '<div class="card"><div class="tit-graf">Tabella (kg)</div><div class="tab-scorri"><table class="tab-mesi"><tr><th class="nome">Specie</th>' +
      anni.map(a => `<th>${a}</th>`).join('') + '<th>Sempre</th></tr>' + righe.join('') + '</table></div></div>';
    el.innerHTML = h;
    GR.disegna(el.querySelector('#g-racc'), {
      tooltip: GR.tooltip({ axisPointer: { type: 'shadow' }, valueFormatter: v => (v ? num(v) + ' kg' : '–') }),
      legend: GR.legenda(anni.map(String)),
      grid: { left: 8, right: 16, top: 32, bottom: 16, containLabel: true },
      xAxis: { type: 'value', name: 'kg', axisLabel: { color: COL.GRIGIO_ASSI, fontSize: 10 }, nameTextStyle: { color: COL.GRIGIO_ASSI }, splitLine: { lineStyle: { color: COL.LINEE } } },
      yAxis: { type: 'category', inverse: true, data: specie.map(nome), axisLabel: { color: COL.GRIGIO_ASSI, fontSize: 10, width: 100, overflow: 'truncate' } },
      series: anni.map((a, i) => ({ name: String(a), type: 'bar', barMaxWidth: 10, itemStyle: { color: COLORI_ANNI[i], borderRadius: [0, 3, 3, 0] },
        data: specie.map(sid => Math.round((dati[sid][a] || 0) * 100) / 100 || null) })),
    });
  }

  // ============================================================ SCHEDA: tempo
  function cartaTempo(s) {
    const d = G.Archivio.d;
    const n = Q.pianteDi(d, s.id).length;
    let h = '<div class="card"><div class="tit-graf">⏱ Tempo di lavoro stimato</div>';
    if (!n) return h + '<div class="piccolo">Nessuna pianta sulla mappa: nessun tempo conteggiato.</div></div>';
    const om = Q.orePerMese(d, null, null, [s.id]);
    const somma = r => r.reduce((t, v) => t + v, 0);
    const tot = Object.values(om).reduce((t, r) => t + somma(r), 0);
    h += `<div><b style="font-size:20px">${G.fmtOre(tot)}</b> <span class="piccolo">all'anno (${n} ${n === 1 ? 'pianta' : 'piante'})</span></div>`;
    for (const [tipo, info] of Object.entries(TIPI_ATTIVITA)) {
      const x = om[s.id + '|' + tipo];
      if (x && somma(x)) h += `<div class="piccolo">${info.label}: ${G.fmtOre(somma(x))}</div>`;
    }
    return h + '<div class="graf" id="g-tempo-scheda" style="height:110px"></div><a class="piccolo" href="#fare/ore">Tutte le ore di lavoro ›</a></div>';
  }
  function disegnaTempo(el, s) {
    const box = el.querySelector('#g-tempo-scheda');
    if (!box) return;
    const om = Q.orePerMese(G.Archivio.d, null, null, [s.id]);
    const mesi = new Array(12).fill(0);
    Object.values(om).forEach(r => r.forEach((v, i) => { mesi[i] += v; }));
    const m = G.meseCorrente();
    GR.disegna(box, {
      grid: { left: 4, right: 4, top: 8, bottom: 18 },
      tooltip: GR.tooltip({ valueFormatter: v => num(v) + ' h' }),
      xAxis: { type: 'category', data: MESI.map(x => x[0].toUpperCase()), axisLabel: { color: COL.GRIGIO_ASSI, fontSize: 10, interval: 0 }, axisTick: { show: false } },
      yAxis: { type: 'value', show: false },
      series: [{ type: 'bar', data: mesi.map((v, i) => ({ value: Math.round(v * 100) / 100,
        itemStyle: { color: i + 1 === m ? '#2f6b3a' : '#8aa67a', borderRadius: [3, 3, 0, 0] } })) }],
    });
  }

  window.Analisi = { vistaOre, vistaCalendario, vistaPeriodo, vistaStorico, raccolti, cartaTempo, disegnaTempo, cap };
})();
