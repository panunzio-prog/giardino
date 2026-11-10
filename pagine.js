// Pagine: Da fare, Schede (elenco e modifica), Diario (+ raccolti), Meteo.
(function () {
  const G = window.Giardino;
  const { Q, TIPI_ATTIVITA, CATEGORIE, MESI, MESI_LUNGHI } = G;
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, dec = 1) => Number(v).toFixed(dec).replace('.', ',');

  function htmlMesi(mesi, colore, ora) {
    return '<div class="mesi">' + MESI.map((m, i) => (mesi || []).includes(i + 1)
      ? `<span class="mese-chip on${i + 1 === ora ? ' ora' : ''}" style="background:${colore}">${m}</span>`
      : `<span class="mese-chip">${m}</span>`).join('') + '</div>';
  }

  // =================================================================== DA FARE
  const fare = { mese: G.meseCorrente(), tipi: ['potatura', 'concimazione', 'trattamento'], nascondiFatte: false };

  function paginaFare(main) {
    const d = G.Archivio.d;
    const anno = G.annoCorrente();
    const mese = fare.mese;
    const voci = Q.attivitaDelMese(d, mese, fare.tipi, true);
    let h = `<div class="chips"><button class="chip" data-m="-1">‹</button><button class="chip on" data-m="0">${MESI_LUNGHI[mese - 1]}</button>` +
      `<button class="chip" data-m="1">›</button></div><div class="chips">` +
      Object.entries(TIPI_ATTIVITA).map(([k, t]) => `<button class="chip${fare.tipi.includes(k) ? ' on' : ''}" data-t="${k}">${t.emoji} ${t.label}</button>`).join('') +
      `<button class="chip${fare.nascondiFatte ? ' on' : ''}" id="nasc">Nascondi fatte</button></div>`;
    if (!voci.length) {
      main.innerHTML = h + '<div class="vuoto">Niente da fare per i filtri scelti. 🌤️</div>';
    } else {
      const tot = voci.reduce((t, [s, a]) => t + Q.oreAttivitaMese(s, a, Q.pianteDi(d, s.id).length), 0);
      if (tot) h += `<div class="piccolo" style="margin-top:6px">⏱ Tempo stimato per ${MESI_LUNGHI[mese - 1].toLowerCase()}: circa ${G.fmtOre(tot)}</div>`;
      for (const tipo of Object.keys(TIPI_ATTIVITA)) {
        const gruppo = voci.filter(([, a]) => a.tipo === tipo);
        if (!gruppo.length) continue;
        const t = TIPI_ATTIVITA[tipo];
        let blocco = '';
        for (const [s, a] of gruppo) {
          const piante = Q.pianteDi(d, s.id);
          const stato = Object.fromEntries(piante.map(p => [p.id, Q.fattoStagione(d, a, p.id, anno)]));
          const fatte = piante.filter(p => stato[p.id]).length;
          if (fare.nascondiFatte && piante.length && fatte === piante.length) continue;
          const [minuti] = Q.tempi(s, a);
          blocco += `<div class="card" style="border-top:4px solid ${t.colore}">` +
            `<div class="riga">${UI.iconaSpecie(s, 40)}<div class="cresce"><a href="#scheda/${s.id}"><b>${esc(s.nome)}</b></a>` +
            `<div>${esc(a.titolo)}</div></div><span class="badge${fatte === piante.length ? ' ok' : ''}">${fatte}/${piante.length}</span></div>` +
            (a.prodotto || a.dose ? `<div class="piccolo">🧴 ${esc([a.prodotto, a.dose].filter(Boolean).join(' · '))}</div>` : '') +
            (a.note ? `<div class="piccolo">${esc(a.note)}</div>` : '') +
            `<div class="piccolo">⏱ ≈ ${G.fmtOre(Q.oreAttivitaMese(s, a, piante.length))} nel mese (${minuti} min per pianta)</div>` +
            htmlMesi(a.mesi, t.colore, mese);
          for (const p of piante) {
            const z = Q.zonaDi(d, p);
            const f = stato[p.id];
            blocco += `<label class="spunta"><input type="checkbox" data-s="${s.id}" data-a="${a.id}" data-p="${p.id}" ${f ? 'checked' : ''}>` +
              `<span class="cresce">${esc(Q.nomePianta(d, p))}${z ? ` <span class="piccolo">(${esc(z.nome)})</span>` : ''}` +
              `${f ? `<br><span class="piccolo" style="color:#2e7d32">✓ ${esc(f.data)}</span>` : ''}</span>` +
              `<a href="#mappa/${p.id}" class="piccolo" style="text-decoration:none;font-size:20px">📍</a></label>`;
          }
          if (piante.length > 1 && fatte < piante.length) {
            blocco += `<button class="btn leggero piccolo-btn" data-tutte="${s.id}|${a.id}" style="margin-top:6px">✓ Segna tutte fatte</button>`;
          }
          blocco += '</div>';
        }
        if (blocco) h += `<div class="titolo-sez" style="color:${t.colore}">${t.emoji} ${t.label}</div>` + blocco;
      }
      main.innerHTML = h;
    }
    main.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      const k = parseInt(b.dataset.m, 10);
      fare.mese = k ? (fare.mese - 1 + k + 12) % 12 + 1 : G.meseCorrente();
      paginaFare(main);
    });
    main.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const k = b.dataset.t;
      fare.tipi = fare.tipi.includes(k) ? fare.tipi.filter(x => x !== k) : [...fare.tipi, k];
      paginaFare(main);
    });
    main.querySelector('#nasc').onclick = () => { fare.nascondiFatte = !fare.nascondiFatte; paginaFare(main); };
    main.querySelectorAll('input[data-a]').forEach(cb => cb.addEventListener('change', async () => {
      const { s, a, p } = cb.dataset;
      const ok = await UI.salva(dd => G.Mod.segnaFatto(dd, s, a, p, mese, cb.checked), cb.checked ? 'Fatto ✓' : 'Tolto dal diario');
      if (!ok) cb.checked = !cb.checked;
      paginaFare(main);
    }));
    main.querySelectorAll('[data-tutte]').forEach(b => b.onclick = async () => {
      const [sid, aid] = b.dataset.tutte.split('|');
      await UI.salva(dd => Q.pianteDi(dd, sid).forEach(p => G.Mod.segnaFatto(dd, sid, aid, p.id, mese, true)), 'Tutte segnate come fatte');
      paginaFare(main);
    });
  }

  // ==================================================================== SCHEDE
  const filtroSchede = { testo: '', cat: '' };

  function paginaSchede(main) {
    const d = G.Archivio.d;
    let h = `<input class="cerca" id="cerca" type="search" placeholder="Cerca una specie…" value="${esc(filtroSchede.testo)}">` +
      '<div class="chips" style="margin-top:6px"><button class="chip' + (filtroSchede.cat ? '' : ' on') + '" data-c="">Tutte</button>' +
      Object.entries(CATEGORIE).map(([k, c]) => `<button class="chip${filtroSchede.cat === k ? ' on' : ''}" data-c="${k}">${c.label}</button>`).join('') +
      '</div><div id="elenco-schede"></div>';
    main.innerHTML = h;
    const elenco = () => {
      const t = filtroSchede.testo.toLowerCase();
      const ss = Q.specieOrdinate(d).filter(s => (!filtroSchede.cat || s.categoria === filtroSchede.cat) &&
        (!t || `${s.nome} ${s.nome_scientifico || ''}`.toLowerCase().includes(t)));
      main.querySelector('#elenco-schede').innerHTML = ss.map(s => {
        const n = Q.pianteDi(d, s.id).length;
        const c = CATEGORIE[s.categoria] || CATEGORIE.altro;
        const tipi = [...new Set((s.attivita || []).filter(a => (a.mesi || []).includes(G.meseCorrente())).map(a => a.tipo))];
        return `<a class="card riga" href="#scheda/${s.id}" style="text-decoration:none;color:inherit">${UI.iconaSpecie(s, 40)}` +
          `<div class="cresce"><b>${esc(s.nome)}</b><div class="piccolo"><i>${esc(s.nome_scientifico || '')}</i></div>` +
          `<div class="piccolo"><span class="badge" style="background:${c.colore}">${c.label}</span> ${n ? `${n} sulla mappa` : ''} ` +
          tipi.map(k => TIPI_ATTIVITA[k].emoji).join(' ') + '</div></div>›</a>';
      }).join('') || '<div class="vuoto">Nessuna specie trovata</div>';
    };
    elenco();
    main.querySelector('#cerca').addEventListener('input', e => { filtroSchede.testo = e.target.value; elenco(); });
    main.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { filtroSchede.cat = b.dataset.c; paginaSchede(main); });
  }

  function paginaScheda(main, sid, modifica) {
    const d = G.Archivio.d;
    const s = Q.specie(d, sid);
    if (!s) { main.innerHTML = '<div class="vuoto">Scheda non trovata</div>'; return; }
    const c = CATEGORIE[s.categoria] || CATEGORIE.altro;
    const piante = Q.pianteDi(d, sid);
    if (modifica) { formScheda(main, s); return; }
    let h = `<div class="riga" style="margin-top:6px"><a href="#schede" style="font-size:24px;text-decoration:none">‹</a>${UI.iconaSpecie(s, 56)}` +
      `<div class="cresce"><h2 style="margin:0">${esc(s.nome)}</h2><div class="piccolo"><i>${esc(s.nome_scientifico || '')}</i>` +
      `${s.famiglia ? ' · ' + esc(s.famiglia) : ''}</div></div></div>` +
      `<div style="margin:8px 0"><span class="badge" style="background:${c.colore}">${c.label}</span> ` +
      `<span class="piccolo">${piante.length} piante sulla mappa · chioma ${num(s.diametro_m || 1.5)} m</span></div>` +
      '<button class="btn leggero" id="modifica" style="width:100%">✏️ Modifica scheda</button>';
    if (s.descrizione) h += `<div class="card">${esc(s.descrizione)}</div>`;
    const info = G.CAMPI_TESTO.filter(([k]) => k !== 'nome_scientifico' && k !== 'famiglia' && s[k]);
    if (info.length || (s.fioritura || []).length) {
      h += '<div class="card"><table class="tab">' + info.map(([k, l]) => `<tr><th>${l}</th><td>${esc(s[k])}</td></tr>`).join('') +
        ((s.fioritura || []).length ? `<tr><th>Fioritura</th><td>${s.fioritura.map(m => MESI[m - 1]).join(', ')}</td></tr>` : '') +
        '</table></div>';
    }
    if (s.note) h += `<div class="card"><b>Note</b><br>${esc(s.note)}</div>`;
    h += '<div class="titolo-sez">Lavori</div>';
    const ord = Object.keys(TIPI_ATTIVITA);
    for (const a of [...(s.attivita || [])].sort((x, y) => ord.indexOf(x.tipo) - ord.indexOf(y.tipo))) {
      const t = TIPI_ATTIVITA[a.tipo] || TIPI_ATTIVITA.altro;
      const [m, v] = Q.tempi(s, a);
      h += `<div class="card" style="border-left:4px solid ${t.colore}"><b style="color:${t.colore}">${t.emoji} ${esc(a.titolo)}</b>` +
        htmlMesi(a.mesi, t.colore, G.meseCorrente()) +
        (a.prodotto || a.dose ? `<div>🧴 ${esc([a.prodotto, a.dose].filter(Boolean).join(' · '))}</div>` : '') +
        (a.note ? `<div class="piccolo">${esc(a.note)}</div>` : '') +
        `<div class="piccolo">⏱ ${m} min per pianta${v ? ` · ${v}× al mese` : ''}</div></div>`;
    }
    if (piante.length) {
      h += '<div class="titolo-sez">Sulla mappa</div><div class="card">' + piante.map(p => {
        const z = Q.zonaDi(d, p);
        return `<a class="spunta" href="#mappa/${p.id}" style="text-decoration:none;color:inherit"><span class="cresce">${esc(Q.nomePianta(d, p))}` +
          `${z ? ` <span class="piccolo">(${esc(z.nome)})</span>` : ''}</span>📍</a>`;
      }).join('') + '</div>';
    }
    const storico = (s.storico || []).slice(-5).reverse();
    if (storico.length) {
      h += '<div class="titolo-sez" style="font-size:15px">Ultime modifiche</div>' +
        storico.map(x => `<div class="piccolo">${esc(x.data)} – ${esc(x.nota)}</div>`).join('');
    }
    main.innerHTML = h;
    main.querySelector('#modifica').onclick = () => paginaScheda(main, sid, true);
  }

  function formScheda(main, s) {
    const campo = (k, l, val, tipo = 'text') => `<label class="campo">${l}<input data-k="${k}" type="${tipo}" value="${esc(val ?? '')}"></label>`;
    const area = (k, l, val) => `<label class="campo">${l}<textarea data-k="${k}">${esc(val ?? '')}</textarea></label>`;
    const mesiSel = (attr, mesi) => '<div class="sel-mesi" ' + attr + '>' +
      MESI.map((m, i) => `<button type="button" data-mese="${i + 1}" class="${(mesi || []).includes(i + 1) ? 'on' : ''}">${m}</button>`).join('') + '</div>';
    let h = `<div class="riga" style="margin-top:6px">${UI.iconaSpecie(s, 40)}<h2 class="cresce">Modifica scheda</h2></div>`;
    h += '<div class="card">' + campo('nome', 'Nome comune', s.nome) +
      G.CAMPI_TESTO.map(([k, l]) => campo(k, l, s[k])).join('') +
      campo('diametro_m', 'Diametro chioma (m)', String(s.diametro_m ?? '').replace('.', ','), 'text" inputmode="decimal') +
      '<label class="campo">Fioritura</label>' + mesiSel('data-fioritura', s.fioritura) +
      area('descrizione', 'Descrizione', s.descrizione) + area('note', 'Note personali', s.note) + '</div>';
    h += '<div class="titolo-sez">Lavori</div>';
    for (const a of s.attivita || []) {
      const t = TIPI_ATTIVITA[a.tipo] || TIPI_ATTIVITA.altro;
      h += `<div class="card" data-att="${a.id}" style="border-left:4px solid ${t.colore}"><b style="color:${t.colore}">${t.emoji} ${t.label}</b>` +
        `<label class="campo">Titolo<input data-ak="titolo" value="${esc(a.titolo)}"></label>` +
        '<label class="campo">Mesi</label>' + mesiSel('data-mesi', a.mesi) +
        `<label class="campo">Prodotto<input data-ak="prodotto" value="${esc(a.prodotto || '')}"></label>` +
        `<label class="campo">Dose<input data-ak="dose" value="${esc(a.dose || '')}"></label>` +
        `<label class="campo">Note / come fare<textarea data-ak="note">${esc(a.note || '')}</textarea></label>` +
        `<label class="campo">Minuti per pianta<input data-ak="minuti" type="text" inputmode="decimal" value="${esc(a.minuti ?? '')}"></label></div>`;
    }
    h += '<label class="campo">Nota sulla modifica (facoltativa)<input id="nota-mod"></label>' +
      '<div class="riga" style="margin:12px 0 30px"><button class="btn leggero cresce" id="annulla">Annulla</button>' +
      '<button class="btn cresce" id="salva">💾 Salva</button></div>';
    main.innerHTML = h;
    main.querySelectorAll('.sel-mesi button').forEach(b => b.onclick = () => b.classList.toggle('on'));
    main.querySelector('#annulla').onclick = () => paginaScheda(main, s.id);
    main.querySelector('#salva').onclick = async () => {
      const mesiDi = el => [...el.querySelectorAll('button.on')].map(b => parseInt(b.dataset.mese, 10));
      const campi = {};
      main.querySelectorAll('[data-k]').forEach(i => {
        const k = i.dataset.k;
        if (k === 'diametro_m') { const v = parseFloat(String(i.value).replace(',', '.')); campi[k] = isFinite(v) && v > 0 ? v : s[k]; } else campi[k] = i.value;
      });
      if (!campi.nome.trim()) { UI.avviso('Il nome non può essere vuoto', true); return; }
      campi.fioritura = mesiDi(main.querySelector('[data-fioritura]'));
      const att = {};
      main.querySelectorAll('[data-att]').forEach(c => {
        const a = {};
        c.querySelectorAll('[data-ak]').forEach(i => {
          if (i.dataset.ak === 'minuti') { const v = parseFloat(String(i.value).replace(',', '.')); a.minuti = isFinite(v) ? v : ''; } else a[i.dataset.ak] = i.value;
        });
        a.mesi = mesiDi(c.querySelector('[data-mesi]'));
        att[c.dataset.att] = a;
      });
      // si confrontano i valori con quelli letti all'apertura: si salvano solo i campi cambiati qui
      const cambiati = {};
      for (const [k, v] of Object.entries(campi)) if (JSON.stringify(s[k] ?? '') !== JSON.stringify(v ?? '')) cambiati[k] = v;
      const attCambiate = {};
      for (const [aid, ca] of Object.entries(att)) {
        const a0 = (s.attivita || []).find(x => x.id === aid) || {};
        const diff = {};
        for (const [k, v] of Object.entries(ca)) if (JSON.stringify(a0[k] ?? '') !== JSON.stringify(v ?? '')) diff[k] = v;
        if (Object.keys(diff).length) attCambiate[aid] = diff;
      }
      const nota = main.querySelector('#nota-mod').value.trim();
      if (!Object.keys(cambiati).length && !Object.keys(attCambiate).length && !nota) { paginaScheda(main, s.id); return; }
      if (await UI.salva(dd => G.Mod.aggiornaSpecie(dd, s.id, cambiati, attCambiate, nota), 'Scheda salvata')) paginaScheda(main, s.id);
    };
  }

  // ==================================================================== DIARIO
  const diario = { vista: 'interventi', tipo: '', testo: '' };

  function paginaDiario(main) {
    const d = G.Archivio.d;
    let h = '<div class="chips"><button class="chip' + (diario.vista === 'interventi' ? ' on' : '') + '" data-v="interventi">📖 Interventi</button>' +
      '<button class="chip' + (diario.vista === 'raccolti' ? ' on' : '') + '" data-v="raccolti">🧺 Raccolti</button></div>';
    if (diario.vista === 'raccolti') {
      const r = Q.raccolti(d);
      const anni = [...new Set(Object.values(r).flatMap(x => Object.keys(x).map(Number)))].sort().slice(-3);
      const righe = Object.entries(r).map(([sid, v]) => [Q.specie(d, sid), v]).filter(([s]) => s)
        .sort((a, b) => a[0].nome.localeCompare(b[0].nome));
      h += '<button class="btn" id="nuovo-rac" style="width:100%;margin:8px 0">🧺 Registra un raccolto</button>';
      if (!righe.length) h += '<div class="vuoto">Nessun raccolto registrato.</div>';
      else {
        h += '<div class="card"><table class="tab"><tr><th>Specie</th>' + anni.map(a => `<th class="num">${a}</th>`).join('') + '</tr>' +
          righe.map(([s, v]) => `<tr><td>${esc(s.nome)}</td>` + anni.map(a => `<td class="num">${v[a] ? num(v[a], 2) : '—'}</td>`).join('') + '</tr>').join('') +
          '<tr><th>Totale kg</th>' + anni.map(a => `<th class="num">${num(righe.reduce((t, [, v]) => t + (v[a] || 0), 0), 2)}</th>`).join('') + '</tr></table></div>';
      }
      main.innerHTML = h;
      main.querySelector('#nuovo-rac').onclick = () => UI.dialogoDiario({ tipo: 'raccolta' });
    } else {
      h += '<button class="btn" id="nuovo" style="width:100%;margin:8px 0">📝 Registra intervento</button>' +
        `<input class="cerca" id="cerca" type="search" placeholder="Cerca…" value="${esc(diario.testo)}">` +
        '<div class="chips" style="margin-top:6px"><button class="chip' + (diario.tipo ? '' : ' on') + '" data-t="">Tutti</button>' +
        Object.entries(TIPI_ATTIVITA).map(([k, t]) => `<button class="chip${diario.tipo === k ? ' on' : ''}" data-t="${k}">${t.emoji} ${t.label}</button>`).join('') +
        '</div><div id="voci"></div>';
      main.innerHTML = h;
      const voci = () => {
        const t = diario.testo.toLowerCase();
        const vv = [...d.diario].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
          .filter(e => (!diario.tipo || e.tipo === diario.tipo) && (!t || `${e.descrizione} ${e.prodotto || ''}`.toLowerCase().includes(t)))
          .slice(0, 300);
        main.querySelector('#voci').innerHTML = vv.map(e => {
          const ti = TIPI_ATTIVITA[e.tipo] || TIPI_ATTIVITA.altro;
          const p = Q.pianta(d, e.pianta_id || '');
          const s = Q.specie(d, e.specie_id || '');
          const chi = p ? Q.nomePianta(d, p) : (s ? s.nome : '—');
          return `<div class="card" style="border-left:4px solid ${ti.colore};padding:10px"><div class="riga">` +
            `<div class="cresce"><div class="piccolo">${esc(e.data)} · ${ti.label}</div><b>${esc(chi)}</b><div>${esc(e.descrizione)}` +
            `${e.kg ? ` · <b>${num(e.kg, 2)} kg</b>` : ''}</div>` +
            (e.prodotto || e.quantita ? `<div class="piccolo">🧴 ${esc([e.prodotto, e.quantita].filter(Boolean).join(' · '))}</div>` : '') +
            `</div><button class="icona-btn" style="background:transparent;color:var(--grigio)" data-del="${e.id}">🗑</button></div></div>`;
        }).join('') || '<div class="vuoto">Nessun intervento registrato.</div>';
        main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!confirm('Eliminare questa voce del diario?')) return;
          if (await UI.salva(dd => G.Mod.eliminaVoce(dd, b.dataset.del), 'Voce eliminata')) paginaDiario(main);
        });
      };
      voci();
      main.querySelector('#nuovo').onclick = () => UI.dialogoDiario({});
      main.querySelector('#cerca').addEventListener('input', e => { diario.testo = e.target.value; voci(); });
      main.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { diario.tipo = b.dataset.t; paginaDiario(main); });
    }
    main.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { diario.vista = b.dataset.v; paginaDiario(main); });
  }

  // ===================================================================== METEO
  const SOGLIA_GELO = 0, SOGLIA_BRINA = 2, PIOGGIA_RIMANDA = 5, SOGLIA_OK = -5, SOGLIA_IRRIGARE = -20;
  let meteoCache = null;

  function emojiMeteo(c) {
    c = c ?? -1;
    if (c === 0) return '☀️';
    if (c === 1 || c === 2) return '🌤️';
    if (c === 3) return '☁️';
    if (c === 45 || c === 48) return '🌫️';
    if ((c >= 51 && c <= 57) || (c >= 80 && c <= 82)) return '🌦️';
    if (c >= 61 && c <= 67) return '🌧️';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return '❄️';
    if (c >= 95) return '⛈️';
    return '🌡️';
  }
  function nomeGiorno(iso) {
    const oggi = G.oggi();
    const dom = new Date(Date.now() + 86400000);
    const domani = `${dom.getFullYear()}-${String(dom.getMonth() + 1).padStart(2, '0')}-${String(dom.getDate()).padStart(2, '0')}`;
    if (iso === oggi) return 'oggi';
    if (iso === domani) return 'domani';
    const dd = new Date(iso + 'T12:00:00');
    return `${['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][dd.getDay()]} ${dd.getDate()} ${MESI[dd.getMonth()]}`;
  }

  async function scaricaMeteo(luogo) {
    if (meteoCache && Date.now() - meteoCache.ts < 3 * 3600 * 1000 && meteoCache.giorni[7] && meteoCache.oggi === G.oggi()) return meteoCache;
    const q = new URLSearchParams({
      latitude: luogo.lat, longitude: luogo.lon, timezone: 'Europe/Paris', past_days: 7, forecast_days: 7,
      daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,weather_code',
    });
    const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q);
    if (!r.ok) throw new Error('Meteo non disponibile');
    const g = (await r.json()).daily || {};
    const giorni = (g.time || []).map((data, i) => ({
      data, tmin: g.temperature_2m_min[i], tmax: g.temperature_2m_max[i], mm: g.precipitation_sum[i] || 0,
      prob: g.precipitation_probability_max[i], et0: g.et0_fao_evapotranspiration[i] || 0, codice: g.weather_code[i],
    }));
    meteoCache = { ts: Date.now(), oggi: G.oggi(), giorni };
    return meteoCache;
  }

  // stessi avvisi di app/avvisi.py
  function allerte(d, giorni) {
    const oggi = G.oggi();
    const prev = giorni.filter(g => g.data >= oggi);
    const passati = giorni.filter(g => g.data < oggi).slice(-7);
    const out = [];
    const presenti = Q.specieOrdinate(d).filter(s => Q.pianteDi(d, s.id).length);
    const freddi = prev.filter(g => g.tmin != null && g.tmin <= SOGLIA_BRINA);
    if (freddi.length) {
      const p = freddi.reduce((m, g) => (g.tmin < m.tmin ? g : m));
      const mese = parseInt(p.data.slice(5, 7), 10);
      const inFiore = presenti.filter(s => (s.fioritura || []).includes(mese)).map(s => s.nome);
      const gelo = p.tmin <= SOGLIA_GELO;
      let t = `${gelo ? 'Gelo' : 'Rischio brina'} previsto ${nomeGiorno(p.data)} (minima ${Math.round(p.tmin)} °C)`;
      if (inFiore.length) t += `: proteggi le piante in fiore (${inFiore.slice(0, 6).join(', ')}${inFiore.length > 6 ? '…' : ''})`;
      else if (gelo) t += ': proteggi vasi e piante delicate';
      out.push({ livello: gelo && inFiore.length ? 'alto' : 'medio', icona: '❄️', testo: t });
    }
    const anno = G.annoCorrente();
    const daFare = [...new Set(Q.attivitaDelMese(d, G.meseCorrente(), ['trattamento'], true)
      .filter(([s, a]) => Q.pianteDi(d, s.id).some(p => !Q.fattoStagione(d, a, p.id, anno))).map(([s]) => s.nome))].sort();
    if (daFare.length && prev.length) {
      const p48 = prev.slice(0, 2).reduce((t, g) => t + g.mm, 0);
      const asciutti = prev.length >= 3 && prev.slice(0, 3).every(g => g.mm < 1);
      const elenco = daFare.slice(0, 5).join(', ') + (daFare.length > 5 ? '…' : '');
      if (p48 >= PIOGGIA_RIMANDA) out.push({ livello: 'medio', icona: '☔', testo: `Pioggia in arrivo (${Math.round(p48)} mm in 48 ore): rimanda i trattamenti (${elenco})` });
      else if (asciutti) out.push({ livello: 'info', icona: '🧴', testo: `3 giorni asciutti: buon momento per i trattamenti (${elenco})` });
    }
    if (passati.length) {
      const pioggia7 = passati.reduce((t, g) => t + g.mm, 0);
      const et07 = passati.reduce((t, g) => t + g.et0, 0);
      const bil = pioggia7 - et07;
      const p3 = prev.slice(0, 3);
      const pp = p3.reduce((t, g) => t + g.mm, 0), ep = p3.reduce((t, g) => t + g.et0, 0);
      const eff = bil + Math.max(0, pp - ep);
      const stato = eff >= SOGLIA_OK ? null : eff >= SOGLIA_IRRIGARE ? ['info', 'Controlla il terreno'] : ['alto', 'Irrigare'];
      if (stato) {
        out.push({ livello: stato[0], icona: '💧', testo: `${stato[1]}: ultimi 7 giorni pioggia ${Math.round(pioggia7)} mm, evaporazione ` +
          `${Math.round(et07)} mm (bilancio ${bil >= 0 ? '+' : ''}${Math.round(bil)} mm), pioggia prevista nei prossimi 3 giorni ${Math.round(pp)} mm` });
      }
      out.bilancio = { pioggia7, et07, bil };
    }
    const ord = { alto: 0, medio: 1, info: 2 };
    return Object.assign(out.sort((a, b) => ord[a.livello] - ord[b.livello]), { bilancio: out.bilancio });
  }

  async function paginaMeteo(main) {
    const d = G.Archivio.d;
    const luogo = d.impostazioni.luogo;
    main.innerHTML = `<div class="piccolo">📍 ${esc(luogo.nome || '')}</div><div class="vuoto" id="att">Scarico le previsioni…</div>`;
    let m;
    try { m = await scaricaMeteo(luogo); } catch (e) {
      main.querySelector('#att').textContent = 'Previsioni non disponibili (sei offline?)';
      return;
    }
    if (location.hash.split('/')[0] !== '#meteo') return;
    const oggi = G.oggi();
    const prev = m.giorni.filter(g => g.data >= oggi);
    const avv = allerte(d, m.giorni);
    const COL = { alto: '#d84315', medio: '#e0a800', info: '#3b82c4' };
    let h = `<div class="piccolo">📍 ${esc(luogo.nome || '')}</div>`;
    if (avv.length) {
      h += '<div class="titolo-sez">🔔 Avvisi per il giardino</div>' +
        avv.map(a => `<div class="card avviso-meteo" style="border-left-color:${COL[a.livello]}">${a.icona} ${esc(a.testo)}</div>`).join('');
    }
    h += '<div class="titolo-sez">Prossimi 7 giorni</div><div class="card"><table class="tab">' +
      prev.map(g => `<tr><td>${nomeGiorno(g.data)}</td><td style="font-size:22px">${emojiMeteo(g.codice)}</td>` +
        `<td class="num">${g.tmin != null ? Math.round(g.tmin) : '–'}° / ${g.tmax != null ? Math.round(g.tmax) : '–'}°</td>` +
        `<td class="num">🌧 ${num(g.mm)} mm${g.prob != null ? `<br><span class="piccolo">${g.prob}%</span>` : ''}</td></tr>`).join('') +
      '</table></div>';
    if (avv.bilancio) {
      const b = avv.bilancio;
      h += `<div class="titolo-sez">Ultimi 7 giorni</div><div class="card">🌧 Pioggia ${num(b.pioggia7)} mm · 💨 Evaporazione ${num(b.et07)} mm<br>` +
        `<b>Bilancio idrico ${b.bil >= 0 ? '+' : ''}${num(b.bil)} mm</b><div class="piccolo">Sotto −5 mm controlla il terreno, sotto −20 mm irriga.</div></div>`;
    }
    h += '<div class="piccolo" style="margin-top:10px">Dati Open-Meteo. Storico e grafici: nell\'app del PC.</div>';
    main.innerHTML = h;
  }

  window.Pagine = { fare: paginaFare, schede: paginaSchede, scheda: paginaScheda, diario: paginaDiario, meteo: paginaMeteo };
})();
