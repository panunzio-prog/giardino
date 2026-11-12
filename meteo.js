// Storico meteo: legge dati/meteo.json (scritto dal PC, qui solo in lettura) e fa gli stessi calcoli di app/meteo.py.
// Se il PC non aggiorna il file da qualche giorno, gli ultimi giorni si prendono da Open-Meteo (solo in memoria).
(function () {
  const VARIABILI = 'precipitation_sum,shortwave_radiation_sum,et0_fao_evapotranspiration,temperature_2m_min,temperature_2m_max';
  const FUSO = 'Europe/Paris';
  const GIORNI_RECENTI = 10;
  const RINFRESCO_RECENTI_MS = 3 * 3600 * 1000;
  const CONTROLLO_FILE_MS = 30 * 60 * 1000;
  const ANNI_MEDIA = 10;
  const GDD_BASE = 10.0, SOGLIA_GELO = 0.0, SOGLIA_CALDO = 30.0, LISCIA_T = 7;
  const CACHE = 'giardino_meteo';
  const GIORNO = 86400000;

  // ---------------------------------------------------------- date ISO (in UTC, senza problemi di fuso)
  const ms = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const piu = (s, n) => iso(ms(s) + n * GIORNO);
  const diff = (a, b) => Math.round((ms(a) - ms(b)) / GIORNO); // a − b in giorni
  function giorni(da, a) {
    const out = [];
    for (let t = ms(da), f = ms(a); t <= f; t += GIORNO) out.push(iso(t));
    return out;
  }
  const oggi = () => window.Giardino.oggi();
  function annoPrima(s) {
    const y = +s.slice(0, 4) - 1;
    const md = s.slice(5) === '02-29' ? '02-28' : s.slice(5);
    return `${y}-${md}`;
  }
  function primoMeseDopo(s) {
    const y = +s.slice(0, 4), m = +s.slice(5, 7);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  }
  const gradiGiorno = (tmin, tmax) => Math.max(0, (tmin + tmax) / 2 - GDD_BASE);
  function media(xs) {
    xs = xs.filter(x => x != null);
    return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null;
  }

  // ---------------------------------------------------------------- stato
  const M = {
    c: null,           // contenuto di meteo.json
    rev: null,
    controllato: 0,
    recenti: null,     // {ts, giorni: {data: [...]}} scaricati dal telefono
    _clima: undefined,
    _caricamento: null,

    caricaDaCache() {
      if (M.c) return true;
      try {
        const x = JSON.parse(localStorage.getItem(CACHE) || 'null');
        if (x && x.c && x.c.giorni) { M.c = x.c; M.rev = x.rev; M.recenti = x.recenti || null; M._clima = undefined; return true; }
      } catch (e) { /* */ }
      return false;
    },
    salvaCache() {
      try { localStorage.setItem(CACHE, JSON.stringify({ c: M.c, rev: M.rev, recenti: M.recenti })); } catch (e) { /* */ }
    },

    // pronto all'uso: file del PC (riletto se cambiato) + giorni recenti. Lancia errore solo se non c'è nulla.
    pronto(forza) {
      if (!M._caricamento) {
        M._caricamento = M._prepara(forza).finally(() => { M._caricamento = null; });
      }
      return M._caricamento;
    },
    async _prepara(forza) {
      M.caricaDaCache();
      if (forza || !M.c || Date.now() - M.controllato > CONTROLLO_FILE_MS) {
        try {
          const rev = await Dropbox.rev(CONFIG.FILE_METEO);
          if (rev !== M.rev || !M.c) {
            const { testo, rev: r } = await Dropbox.scarica(CONFIG.FILE_METEO);
            M.c = JSON.parse(testo);
            M.rev = r;
            M._clima = undefined;
          }
          M.controllato = Date.now();
        } catch (e) {
          if (!M.c) throw e;
        }
      }
      try { await M._completaRecenti(); } catch (e) { /* offline: si usano i dati che ci sono */ }
      M.salvaCache();
      return M;
    },

    // stessa logica di assicura() per gli ultimi giorni: Open-Meteo "previsioni" con past_days=92
    async _completaRecenti() {
      const ieri = piu(oggi(), -1);
      const soglia = piu(oggi(), -GIORNI_RECENTI);
      const manca = giorni(soglia, ieri).some(d => { const v = M._riga(d); return !v || v.length < 6; });
      const serve = manca || M._ultimoPC() < ieri;
      const vecchi = !M.recenti || Date.now() - M.recenti.ts > RINFRESCO_RECENTI_MS;
      if (!serve || !vecchi) return;
      const q = new URLSearchParams({ latitude: M.c.lat, longitude: M.c.lon, daily: VARIABILI, timezone: FUSO,
        past_days: 92, forecast_days: 1 });
      const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q);
      if (!r.ok) throw new Error('Meteo non disponibile');
      const g = (await r.json()).daily || {};
      const out = {};
      const n = (x, k) => (x == null ? null : Math.round(x * 10 ** k) / 10 ** k);
      (g.time || []).forEach((d, i) => {
        const mm = g.precipitation_sum[i], mj = g.shortwave_radiation_sum[i];
        if (mm == null || mj == null) return;
        out[d] = [n(mm, 2), n(mj / 3.6, 3), 'recente', n((g.et0_fao_evapotranspiration || [])[i], 2),
          n((g.temperature_2m_min || [])[i], 1), n((g.temperature_2m_max || [])[i], 1)];
      });
      M.recenti = { ts: Date.now(), giorni: out };
      M._clima = undefined;
    },
    _ultimoPC() {
      const k = Object.keys(M.c.giorni);
      return k.length ? k.reduce((m, x) => (x > m ? x : m)) : '';
    },
    // il dato del PC vale se è d'archivio o completo; altrimenti quello scaricato qui
    _riga(d) {
      const v = M.c.giorni[d];
      const r = M.recenti && M.recenti.giorni[d];
      if (v && (v[2] === 'archivio' || !r)) return v;
      return r || v || null;
    },

    // ------------------------------------------------------------- letture
    valore(d, chiave) {
      const v = M._riga(d);
      if (!v) return null;
      if (chiave === 'mm') return v[0];
      if (chiave === 'kwh') return v[1];
      if (chiave === 'tmin' || chiave === 'tmax' || chiave === 'gdd') {
        if (v.length < 6 || v[4] == null || v[5] == null) return null;
        if (chiave === 'gdd') return gradiGiorno(v[4], v[5]);
        return chiave === 'tmin' ? v[4] : v[5];
      }
      const et0 = v.length > 3 ? v[3] : null;
      if (et0 == null) return null;
      return chiave === 'et0' ? et0 : v[0] - et0;
    },
    serie(da, a) {
      return giorni(da, a).map(d => { const v = M._riga(d); return [d, v ? v[0] : null, v ? v[1] : null]; });
    },
    totali(da, a) {
      const s = M.serie(da, a).filter(x => x[1] != null);
      if (!s.length) return { giorni: 0 };
      const piuPioggia = s.reduce((m, x) => (x[1] > m[1] ? x : m));
      const piuSole = s.reduce((m, x) => (x[2] > m[2] ? x : m));
      const totK = s.reduce((t, x) => t + x[2], 0);
      const totMm = s.reduce((t, x) => t + x[1], 0);
      const et0 = s.map(x => M.valore(x[0], 'et0'));
      const totEt0 = et0.some(e => e != null) ? et0.reduce((t, e) => t + (e || 0), 0) : null;
      const temp = s.map(x => [x[0], M.valore(x[0], 'tmin'), M.valore(x[0], 'tmax')]).filter(t => t[1] != null);
      let extra;
      if (temp.length) {
        const fredda = temp.reduce((m, t) => (t[1] < m[1] ? t : m));
        const calda = temp.reduce((m, t) => (t[2] > m[2] ? t : m));
        extra = {
          tmin_medio: media(temp.map(t => t[1])), tmax_medio: media(temp.map(t => t[2])),
          t_min_assoluta: [fredda[0], fredda[1]], t_max_assoluta: [calda[0], calda[2]],
          giorni_gelo: temp.filter(t => t[1] <= SOGLIA_GELO).length,
          giorni_caldo: temp.filter(t => t[2] >= SOGLIA_CALDO).length,
          gdd: temp.reduce((x, t) => x + gradiGiorno(t[1], t[2]), 0), giorni_temp: temp.length,
        };
      } else extra = { tmin_medio: null, tmax_medio: null, giorni_temp: 0 };
      return Object.assign(extra, {
        giorni: s.length, giorni_attesi: diff(a, da) + 1, mm: totMm, kwh: totK, kwh_medio: totK / s.length,
        giorni_pioggia: s.filter(x => x[1] >= 1.0).length,
        max_pioggia: [piuPioggia[0], piuPioggia[1]], max_sole: [piuSole[0], piuSole[2]],
        et0: totEt0, bilancio: totEt0 == null ? null : totMm - totEt0,
      });
    },

    // media per giorno dell'anno sugli ultimi 10 anni completi: "MM-GG" -> [mm, kwh, et0, tmin, tmax, gdd, p_gelo, p_caldo]
    clima() {
      if (M._clima !== undefined) return M._clima;
      const a1 = +oggi().slice(0, 4) - 1, a0 = a1 - ANNI_MEDIA + 1;
      const somme = {};
      for (const [k, v] of Object.entries(M.c.giorni)) {
        const anno = +k.slice(0, 4);
        if (anno < a0 || anno > a1) continue;
        const md = k.slice(5);
        const s = somme[md] = somme[md] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        s[0] += v[0]; s[1] += v[1]; s[2] += 1;
        if (v.length > 3 && v[3] != null) { s[3] += v[3]; s[4] += 1; }
        if (v.length > 5 && v[4] != null && v[5] != null) {
          s[5] += v[4]; s[6] += v[5]; s[7] += gradiGiorno(v[4], v[5]);
          s[8] += v[4] <= SOGLIA_GELO ? 1 : 0; s[9] += v[5] >= SOGLIA_CALDO ? 1 : 0; s[10] += 1;
        }
      }
      const minimo = md => (md === '02-29' ? 2 : ANNI_MEDIA * 0.8);
      const complete = Object.keys(somme).filter(md => somme[md][2] >= minimo(md));
      if (complete.length < 365) { M._clima = null; return null; }
      const calendario = giorni('2024-01-01', '2024-12-31').map(d => d.slice(5));
      const grezze = {};
      for (const md of calendario) {
        const s = somme[md];
        grezze[md] = s && s[10] >= minimo(md) ? [5, 6, 7, 8, 9].map(i => s[i] / s[10]) : null;
      }
      const n = calendario.length;
      const out = {};
      calendario.forEach((md, i) => {
        const vicini = [];
        for (let j = -LISCIA_T; j <= LISCIA_T; j++) { const x = grezze[calendario[(i + j + n) % n]]; if (x) vicini.push(x); }
        const liscia = vicini.length ? [0, 1, 2, 3, 4].map(k => vicini.reduce((t, x) => t + x[k], 0) / vicini.length) : [null, null, null, null, null];
        if (complete.includes(md)) {
          const s = somme[md];
          out[md] = [s[0] / s[2], s[1] / s[2], s[4] ? s[3] / s[4] : 0, ...liscia];
        }
      });
      M._clima = out;
      return out;
    },
    _cg(c, d) { return c[d.slice(5)] || c[d.slice(5, 8) + '28']; },

    mediaPeriodo(da, a) {
      const c = M.clima();
      if (!c) return null;
      let mm = 0, kwh = 0;
      for (const d of giorni(da, a)) { const v = M._cg(c, d); mm += v[0]; kwh += v[1]; }
      return [mm, kwh];
    },
    mediaTemp(da, a) {
      const c = M.clima();
      if (!c) return null;
      const vs = giorni(da, a).map(d => M._cg(c, d));
      if (!vs.length || vs.some(v => !v || v[3] == null)) return null;
      const somma = k => vs.reduce((t, v) => t + v[k], 0);
      return { tmin: somma(3) / vs.length, tmax: somma(4) / vs.length, gdd: somma(5), gelo: somma(6), caldo: somma(7) };
    },

    // ------------------------------------------------------- aggregazioni
    periodoStorico(scelta) {
      const fineIeri = piu(oggi(), -1);
      if (scelta === '12m') return [piu(fineIeri, -(52 * 7 - 1)), fineIeri];
      const fine = `${scelta}-12-31`;
      return [`${scelta}-01-01`, fine < fineIeri ? fine : fineIeri];
    },
    intervalli(da, a, passo) {
      const out = [];
      let inizio = da;
      while (inizio <= a) {
        let fine = passo === 'mese' ? piu(primoMeseDopo(inizio), -1)
          : piu(inizio, { giorno: 1, settimana: 7, quindicina: 14 }[passo] - 1);
        if (fine > a) fine = a;
        out.push([inizio, fine]);
        inizio = piu(fine, 1);
      }
      return out;
    },
    blocchi(da, a, passo = 'settimana') {
      return M.intervalli(da, a, passo).map(([inizio, fine]) => {
        const s = M.serie(inizio, fine).filter(x => x[1] != null);
        const gg = giorni(inizio, fine);
        return {
          inizio, fine, centro: piu(inizio, Math.floor(diff(fine, inizio) / 2)),
          mm: s.length ? s.reduce((t, x) => t + x[1], 0) : null,
          kwh: s.length ? s.reduce((t, x) => t + x[2], 0) : null, n: s.length,
          tmin: media(gg.map(d => M.valore(d, 'tmin'))), tmax: media(gg.map(d => M.valore(d, 'tmax'))),
        };
      });
    },
    cumulata(da, a, chiave = 'mm') {
      let tot = 0;
      return giorni(da, a).map(d => {
        const v = M.valore(d, chiave);
        if (v == null) return [d, null];
        tot += v;
        return [d, tot];
      });
    },
    cumulataMedia(da, a, chiave = 'mm') {
      const c = M.clima();
      if (!c) return null;
      let tot = 0;
      const out = [];
      for (const d of giorni(da, a)) {
        const v = M._cg(c, d);
        const [mm, kwh, et0, gdd] = [v[0], v[1], v[2], v[5]];
        if (chiave === 'gdd' && gdd == null) return null;
        tot += { mm, kwh, et0, bilancio: mm - et0, gdd }[chiave];
        out.push([d, tot]);
      }
      return out;
    },
    mesi(da, a) {
      const out = [];
      let m = da.slice(0, 8) + '01';
      while (m <= a) {
        const prossimo = primoMeseDopo(m);
        const i = m > da ? m : da;
        const fm = piu(prossimo, -1);
        const f = fm < a ? fm : a;
        const t = M.totali(i, f);
        const med = M.mediaPeriodo(i, f);
        const mt = M.mediaTemp(i, f) || {};
        out.push({
          mese: m, inizio: i, fine: f, parziale: diff(f, i) + 1 < diff(prossimo, m),
          mm: t.mm ?? null, kwh: t.kwh ?? null, giorni_pioggia: t.giorni_pioggia ?? null,
          media_mm: med ? med[0] : null, media_kwh: med ? med[1] : null,
          tmin: t.tmin_medio ?? null, tmax: t.tmax_medio ?? null, gelo: t.giorni_gelo ?? null, caldo: t.giorni_caldo ?? null,
          media_tmin: mt.tmin ?? null, media_tmax: mt.tmax ?? null, media_gelo: mt.gelo ?? null, media_caldo: mt.caldo ?? null,
        });
        m = prossimo;
      }
      return out;
    },
    anniDisponibili() {
      const y = +oggi().slice(0, 4);
      const out = [];
      for (let a = y; a >= y - ANNI_MEDIA; a--) out.push(a);
      return out;
    },
  };

  window.MeteoStorico = Object.assign(M, { annoPrima, piu, diff, giorni, iso, ms });
})();
