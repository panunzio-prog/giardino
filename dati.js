// Modello dati: stessa struttura di app/data.py (file giardino.json condiviso con il PC).
(function () {
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const MESI_LUNGHI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio',
    'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  const TIPI_ATTIVITA = {
    potatura: { label: 'Potatura', colore: '#8e44ad', sigla: 'P', emoji: '✂️' },
    concimazione: { label: 'Concimazione', colore: '#b9770e', sigla: 'C', emoji: '🌾' },
    trattamento: { label: 'Trattamento', colore: '#c0392b', sigla: 'T', emoji: '🧴' },
    raccolta: { label: 'Raccolta', colore: '#1e8449', sigla: 'R', emoji: '🧺' },
    altro: { label: 'Altro', colore: '#2e86c1', sigla: 'A', emoji: '🔧' },
  };

  const CATEGORIE = {
    frutteto: { label: 'Frutteto', colore: '#e67e22' },
    piccoli_frutti: { label: 'Piccoli frutti', colore: '#c0392b' },
    aromatiche: { label: 'Aromatiche', colore: '#27ae60' },
    ornamentale: { label: 'Ornamentale', colore: '#16a085' },
    orto: { label: 'Orto', colore: '#7cb342' },
    altro: { label: 'Altro', colore: '#7f8c8d' },
  };

  const TIPI_ZONA = {
    strada: { label: 'Strada', fill: '#cfd2d6', stroke: '#9ea3a8', dash: '', z: 0 },
    prato: { label: 'Prato', fill: '#d6ecc1', stroke: '#a5cf86', dash: '', z: 1 },
    vialetto: { label: 'Vialetto / cortile', fill: '#e8dcc8', stroke: '#c2ab88', dash: '', z: 2 },
    terrazza: { label: 'Terrazza', fill: '#eadfd2', stroke: '#b39b84', dash: '', z: 2 },
    frutteto: { label: 'Frutteto', fill: '#e3efc9', stroke: '#8bb35b', dash: '6 3', z: 3 },
    orto: { label: 'Orto', fill: '#efe3b8', stroke: '#b59a3c', dash: '', z: 3 },
    aiuola: { label: 'Aiuola', fill: '#bfe0b0', stroke: '#6ea35a', dash: '', z: 4 },
    siepe: { label: 'Siepe / bordura', fill: '#7fb069', stroke: '#4e7f3a', dash: '', z: 4 },
    acqua: { label: 'Acqua', fill: '#b3e0f2', stroke: '#4fa3c7', dash: '', z: 4 },
    annesso: { label: 'Annesso / capanno', fill: '#d9d4cc', stroke: '#7d756b', dash: '', z: 5 },
    casa: { label: 'Casa', fill: '#e3ddd3', stroke: '#5d5348', dash: '', z: 6 },
    chioma: { label: 'Albero esistente', fill: '#8fbf73', stroke: '#4e7f3a', dash: '5 4', z: 7 },
    altro: { label: 'Altro', fill: '#fff3b0', stroke: '#c9b24a', dash: '', z: 4 },
  };
  TIPI_ZONA.edificio = TIPI_ZONA.annesso;

  const TAGLIE = { XS: 0.5, S: 1.0, M: 2.0, L: 3.5, XL: 5.0 };

  const MINUTI_BASE = {
    potatura: [5, 15, 40, 60], concimazione: [2, 5, 8, 10], trattamento: [2, 4, 7, 10],
    raccolta: [3, 10, 20, 30], altro: [5, 10, 15, 20],
  };
  const LEGGERE = ['verde', 'cimatur', 'diradamento', 'pulizia', 'taglio dei fusti', 'taglio a raso', 'taglio dei fiori',
    'taglio degli steli', 'taglio fiori', 'taglio dopo la fioritura', 'rifilatura', 'ritocchi', 'spuntatura'];

  const CAMPI_TESTO = [
    ['nome_scientifico', 'Nome scientifico'], ['famiglia', 'Famiglia'], ['altezza_m', 'Dimensioni / altezza'],
    ['esposizione', 'Esposizione'], ['terreno', 'Terreno'], ['irrigazione', 'Irrigazione'],
    ['rusticita', 'Rusticità'], ['impollinazione', 'Impollinazione'],
  ];

  // ------------------------------------------------------------------ utilità
  function pad(n) { return String(n).padStart(2, '0'); }
  function oggi() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function meseCorrente() { return new Date().getMonth() + 1; }
  function annoCorrente() { return new Date().getFullYear(); }
  function nuovoId(pref) {
    const b = crypto.getRandomValues(new Uint8Array(4));
    return pref + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  }
  function dataPerMese(mese, anno) {
    anno = anno || annoCorrente();
    if (mese === meseCorrente() && anno === annoCorrente()) return oggi();
    return `${anno}-${pad(mese)}-01`;
  }
  function fmtOre(h) {
    const m = Math.round(h * 60);
    if (m < 60) return `${m} min`;
    return m % 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m / 60} h`;
  }

  function tagliaSpecie(s) {
    let d = parseFloat(s.diametro_m);
    if (!isFinite(d) || !d) d = 1.5;
    return d < 1 ? 0 : d <= 2.5 ? 1 : d <= 4.5 ? 2 : 3;
  }
  function stimaMinuti(s, a) {
    const tipo = MINUTI_BASE[a.tipo] ? a.tipo : 'altro';
    const t = tagliaSpecie(s);
    const testo = `${a.titolo || ''} ${a.prodotto || ''}`.toLowerCase();
    let minuti = MINUTI_BASE[tipo][t];
    let volte = 0;
    if (tipo === 'potatura' && LEGGERE.some(k => testo.includes(k))) minuti = Math.max(5, Math.round(minuti / 2));
    else if (tipo === 'trattamento' && ['trappol', 'a mano', 'pulizia'].some(k => testo.includes(k))) minuti = 5;
    if (tipo === 'raccolta') volte = { piccoli_frutti: 6, frutteto: 2 }[s.categoria] || 4;
    else if (['zolfo', 'sapone', 'peronospora'].some(k => testo.includes(k))) volte = 2;
    else if (testo.includes('drosophila')) volte = 1;
    return [minuti, volte];
  }
  function completaTempi(s, a) {
    if (a.minuti == null || a.minuti === '' || a.volte_mese == null) {
      const [m, v] = stimaMinuti(s, a);
      if (a.minuti == null || a.minuti === '') a.minuti = m;
      if (a.volte_mese == null) a.volte_mese = v;
    }
  }

  function areaPoligono(pp) {
    const n = pp.length;
    if (n < 3) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) s += pp[i][0] * pp[(i + 1) % n][1] - pp[(i + 1) % n][0] * pp[i][1];
    return Math.abs(s) / 2;
  }
  function centroPoligono(pp) {
    const n = pp.length;
    let a = 0;
    for (let i = 0; i < n; i++) a += pp[i][0] * pp[(i + 1) % n][1] - pp[(i + 1) % n][0] * pp[i][1];
    a /= 2;
    if (Math.abs(a) < 1e-9) return [pp.reduce((t, p) => t + p[0], 0) / n, pp.reduce((t, p) => t + p[1], 0) / n];
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pp[i], [x1, y1] = pp[(i + 1) % n];
      const f = x0 * y1 - x1 * y0;
      cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    return [cx / (6 * a), cy / (6 * a)];
  }
  function dentro(x, y, pp) {
    let ok = false;
    for (let i = 0, j = pp.length - 1; i < pp.length; j = i++) {
      const [xi, yi] = pp[i], [xj, yj] = pp[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) ok = !ok;
    }
    return ok;
  }

  // raddrizza un quadrilatero disegnato a mano (come rettangolo() in app/data.py)
  function rettangolo(pp) {
    if (pp.length !== 4) return pp;
    const lati = [0, 1, 2, 3].map(i => [pp[(i + 1) % 4][0] - pp[i][0], pp[(i + 1) % 4][1] - pp[i][1]]);
    let sx = 0, sy = 0;
    for (const [dx, dy] of lati) {
      const l = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      sx += Math.cos(4 * a) * l; sy += Math.sin(4 * a) * l;
    }
    let ang = Math.atan2(sy, sx) / 4;
    const a0 = Math.atan2(lati[0][1], lati[0][0]);
    while (a0 - ang > Math.PI / 4) ang += Math.PI / 2;
    while (ang - a0 > Math.PI / 4) ang -= Math.PI / 2;
    const L = (Math.hypot(...lati[0]) + Math.hypot(...lati[2])) / 2;
    const W = (Math.hypot(...lati[1]) + Math.hypot(...lati[3])) / 2;
    const cx = pp.reduce((t, p) => t + p[0], 0) / 4, cy = pp.reduce((t, p) => t + p[1], 0) / 4;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const croce = lati[0][0] * lati[1][1] - lati[0][1] * lati[1][0];
    const [vx, vy] = croce > 0 ? [-uy, ux] : [uy, -ux];
    const r2 = v => Math.round(v * 100) / 100;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) =>
      [r2(cx + su * L / 2 * ux + sv * W / 2 * vx), r2(cy + su * L / 2 * uy + sv * W / 2 * vy)]);
  }

  // --------------------------------------------------------- letture sui dati
  // Tutte le funzioni ricevono d (il contenuto di giardino.json)
  const Q = {
    imp: d => d.impostazioni,
    specie: (d, sid) => d.specie.find(s => s.id === sid) || null,
    pianta: (d, pid) => d.piante.find(p => p.id === pid) || null,
    zona: (d, zid) => d.zone.find(z => z.id === zid) || null,
    specieOrdinate: d => [...d.specie].sort((a, b) => a.nome.toLowerCase().localeCompare(b.nome.toLowerCase())),
    pianteDi: (d, sid) => d.piante.filter(p => p.specie_id === sid),
    nomePianta(d, p) {
      const s = Q.specie(d, p.specie_id);
      const base = s ? s.nome : '?';
      const extra = p.etichetta || p.varieta;
      return extra ? `${base} – ${extra}` : base;
    },
    diametroPianta(d, p) {
      if (p.diametro_m) return parseFloat(p.diametro_m);
      const s = Q.specie(d, p.specie_id);
      return parseFloat((s || {}).diametro_m) || 1.5;
    },
    zonaDi(d, p) {
      if (p.x == null) return null;
      const cand = d.zone.filter(z => !['strada', 'chioma'].includes(z.tipo) && z.punti && dentro(p.x, p.y, z.punti));
      if (!cand.length) return null;
      return cand.reduce((m, z) => (areaPoligono(z.punti) < areaPoligono(m.punti) ? z : m));
    },
    fatto(d, attId, pid, anno, mese) {
      const pref = `${anno}-${pad(mese)}`;
      return d.diario.find(e => e.attivita_id === attId && e.pianta_id === pid && (e.data || '').startsWith(pref)) || null;
    },
    fattoStagione(d, a, pid, anno) {
      for (const m of a.mesi || []) {
        const e = Q.fatto(d, a.id, pid, anno, m);
        if (e) return e;
      }
      return null;
    },
    attivitaDelMese(d, mese, tipi, soloPresenti) {
      const out = [];
      for (const s of Q.specieOrdinate(d)) {
        if (soloPresenti && !Q.pianteDi(d, s.id).length) continue;
        for (const a of s.attivita || []) {
          if ((a.mesi || []).includes(mese) && (!tipi || !tipi.length || tipi.includes(a.tipo))) out.push([s, a]);
        }
      }
      return out;
    },
    tempi(s, a) {
      let [m, v] = stimaMinuti(s, a);
      if (a.minuti != null && a.minuti !== '' && isFinite(parseFloat(a.minuti))) m = parseFloat(a.minuti);
      if (a.volte_mese != null) v = parseInt(a.volte_mese, 10);
      return [m, v];
    },
    oreAttivitaMese(s, a, n) {
      const mesi = a.mesi || [];
      if (!mesi.length || !n) return 0;
      const [m, v] = Q.tempi(s, a);
      return m * n * (v ? v : 1 / mesi.length) / 60;
    },
    raccolti(d) {
      const out = {};
      for (const e of d.diario) {
        if (e.kg && e.specie_id) {
          const anno = parseInt(e.data.slice(0, 4), 10);
          const r = out[e.specie_id] = out[e.specie_id] || {};
          r[anno] = (r[anno] || 0) + parseFloat(e.kg);
        }
      }
      return out;
    },
    // {"specie_id|tipo": [ore gen..dic]} per le piante presenti (come ore_per_mese in app/data.py)
    orePerMese(d, tipi, categorie, specieIds) {
      const out = {};
      for (const s of d.specie) {
        if (categorie && categorie.length && !categorie.includes(s.categoria)) continue;
        if (specieIds && specieIds.length && !specieIds.includes(s.id)) continue;
        const n = Q.pianteDi(d, s.id).length;
        if (!n) continue;
        for (const a of s.attivita || []) {
          if (tipi && tipi.length && !tipi.includes(a.tipo)) continue;
          const h = Q.oreAttivitaMese(s, a, n);
          if (!h) continue;
          const k = s.id + '|' + (a.tipo || 'altro');
          const riga = out[k] = out[k] || new Array(12).fill(0);
          for (const mm of a.mesi || []) { const m = parseInt(mm, 10); if (m >= 1 && m <= 12) riga[m - 1] += h; }
        }
      }
      return out;
    },
    tipiSpecieNelMese: (s, mese) => [...new Set((s.attivita || []).filter(a => (a.mesi || []).includes(mese)).map(a => a.tipo))],
    areaConfine: d => areaPoligono(d.impostazioni.confine || []),
    kgPianta: (d, pid, anno) => d.diario.filter(e => e.pianta_id === pid && (e.data || '').startsWith(String(anno)))
      .reduce((t, e) => t + (parseFloat(e.kg) || 0), 0),
  };

  // ------------------------------------------------------ modifiche ai dati
  // Funzioni pure su d: si possono riapplicare ai dati nuovi se il PC ha salvato nel frattempo.
  const Mod = {
    registra(d, { tipo, descrizione, pianta_id = '', specie_id = '', attivita_id = '', data = null, prodotto = '',
      quantita = '', kg = null }) {
      if (pianta_id && !specie_id) {
        const p = Q.pianta(d, pianta_id);
        specie_id = p ? p.specie_id : '';
      }
      const e = { id: nuovoId('d_'), data: data || oggi(), tipo, descrizione, pianta_id, specie_id, attivita_id,
        prodotto, quantita };
      if (kg) e.kg = Math.round(parseFloat(kg) * 1000) / 1000;
      d.diario.push(e);
      return e;
    },
    eliminaVoce(d, did) { d.diario = d.diario.filter(e => e.id !== did); },
    // segna/annulla "fatto" di un'attività per una pianta (stessa logica della pagina "Da fare" del PC)
    segnaFatto(d, sid, attId, pid, mese, fatto) {
      const s = Q.specie(d, sid);
      const a = s && (s.attivita || []).find(x => x.id === attId);
      if (!a || !Q.pianta(d, pid)) return;
      const anno = annoCorrente();
      const gia = Q.fattoStagione(d, a, pid, anno);
      if (fatto && !gia) {
        Mod.registra(d, { tipo: a.tipo, descrizione: a.titolo, pianta_id: pid, attivita_id: a.id,
          data: dataPerMese(mese), prodotto: a.prodotto || '', quantita: a.dose || '' });
      } else if (!fatto && gia) {
        Mod.eliminaVoce(d, gia.id);
      }
    },
    spostaPianta(d, pid, x, y) {
      const p = Q.pianta(d, pid);
      if (p) { p.x = Math.round(x * 100) / 100; p.y = Math.round(y * 100) / 100; }
    },
    diametroPianta(d, pid, v) {
      const p = Q.pianta(d, pid);
      if (p) p.diametro_m = v;
    },
    // ------------------------------------------------------------ specie
    nuovaSpecie(d, sid, nome, categoria) {
      const s = {
        id: sid, nome, nome_scientifico: '', famiglia: '', categoria: categoria || 'frutteto', icona: '🌱',
        diametro_m: 2.0, altezza_m: '', descrizione: '', esposizione: '', terreno: '', irrigazione: '',
        rusticita: '', impollinazione: '', fioritura: [], note: '', attivita: [],
        storico: [{ data: oggi(), nota: 'Scheda creata (da iPhone)' }],
      };
      d.specie.push(s);
      return s;
    },
    eliminaSpecie(d, sid) {
      d.specie = d.specie.filter(s => s.id !== sid);
      d.piante = d.piante.filter(p => p.specie_id !== sid);
    },
    // ------------------------------------------------------------ piante
    aggiungiPianta(d, pid, specie_id, x, y) {
      const r2 = v => Math.round(v * 100) / 100;
      const p = { id: pid, specie_id, etichetta: '', varieta: '', x: r2(x), y: r2(y), diametro_m: null,
        data_impianto: '', note: '' };
      d.piante.push(p);
      return p;
    },
    eliminaPianta(d, pid) { d.piante = d.piante.filter(p => p.id !== pid); },
    aggiornaPianta(d, pid, campi) {
      const p = Q.pianta(d, pid);
      if (p) Object.assign(p, campi);
    },
    // -------------------------------------------------------------- zone
    aggiungiZona(d, zid, nome, punti, tipo) {
      const r2 = v => Math.round(v * 100) / 100;
      const z = { id: zid, nome, tipo: tipo || 'aiuola', punti: punti.map(([x, y]) => [r2(x), r2(y)]), colore: '', note: '' };
      d.zone.push(z);
      return z;
    },
    aggiornaZona(d, zid, campi) {
      const z = Q.zona(d, zid);
      if (!z) return;
      if (campi.punti) campi = { ...campi, punti: campi.punti.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]) };
      Object.assign(z, campi);
    },
    eliminaZona(d, zid) { d.zone = d.zone.filter(z => z.id !== zid); },

    // aggiorna solo i campi cambiati sul telefono (così non si perdono modifiche fatte sul PC ad altri campi).
    // attNuove: attività complete da aggiungere (con id già assegnato); attEliminate: id da togliere.
    aggiornaSpecie(d, sid, campi, attivitaCambiate, nota, attNuove = [], attEliminate = []) {
      const s = Q.specie(d, sid);
      if (!s) return;
      const cambi = [];
      for (const [k, v] of Object.entries(campi)) {
        if (JSON.stringify(s[k] ?? '') !== JSON.stringify(v ?? '')) { s[k] = v; cambi.push(k); }
      }
      for (const [aid, ca] of Object.entries(attivitaCambiate || {})) {
        const a = (s.attivita || []).find(x => x.id === aid);
        if (!a) continue;
        for (const [k, v] of Object.entries(ca)) {
          if (JSON.stringify(a[k] ?? '') !== JSON.stringify(v ?? '')) { a[k] = v; if (!cambi.includes('attivita')) cambi.push('attivita'); }
        }
        completaTempi(s, a);
      }
      if (attEliminate.length) {
        const prima = (s.attivita || []).length;
        s.attivita = (s.attivita || []).filter(a => !attEliminate.includes(a.id));
        if (s.attivita.length !== prima && !cambi.includes('attivita')) cambi.push('attivita');
      }
      for (const a of attNuove) {
        s.attivita = s.attivita || [];
        if (s.attivita.some(x => x.id === a.id)) continue;
        const nuova = { ...a };
        completaTempi(s, nuova);
        s.attivita.push(nuova);
        if (!cambi.includes('attivita')) cambi.push('attivita');
      }
      if (cambi.length || nota) {
        s.storico = s.storico || [];
        s.storico.push({ data: oggi(), nota: (nota || ('Modificati: ' + cambi.join(', '))) + ' (da iPhone)' });
      }
    },
  };

  function normalizza(d) {
    d.impostazioni = d.impostazioni || {};
    const imp = d.impostazioni;
    if (imp.larghezza_m == null) imp.larghezza_m = 50;
    if (imp.altezza_m == null) imp.altezza_m = 40;
    if (!imp.confine) imp.confine = [];
    if (!imp.luogo) imp.luogo = { nome: 'Le Thillay (95500), Île-de-France', lat: 49.0058, lon: 2.4714 };
    for (const k of ['specie', 'piante', 'zone', 'diario']) if (!Array.isArray(d[k])) d[k] = [];
    return d;
  }

  // ------------------------------------------------------- archivio su Dropbox
  const CACHE = 'giardino_cache';
  const ArchivioDbx = {
    d: null, rev: null, letto: 0, daCache: false,
    ascoltatori: [],

    // stesso formato del PC (Python su Windows: indentazione 1, a capo CRLF)
    serializza(d) { return JSON.stringify(d, null, 1).replace(/\n/g, '\r\n'); },

    caricaDaCache() {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
        if (c && c.d) { this.d = normalizza(c.d); this.rev = c.rev; this.daCache = true; return true; }
      } catch (e) { /* */ }
      return false;
    },
    salvaCache() {
      try { localStorage.setItem(CACHE, JSON.stringify({ d: this.d, rev: this.rev })); } catch (e) { /* */ }
    },

    async carica() {
      const { testo, rev } = await Dropbox.scarica(CONFIG.FILE_DATI);
      this.d = normalizza(JSON.parse(testo));
      this.rev = rev;
      this.letto = Date.now();
      this.daCache = false;
      this.salvaCache();
      return this.d;
    },

    // ricarica solo se il file su Dropbox è cambiato. Restituisce true se i dati sono nuovi.
    async aggiornaSeCambiato() {
      const rev = await Dropbox.rev(CONFIG.FILE_DATI);
      if (rev === this.rev && !this.daCache) { this.letto = Date.now(); return false; }
      await this.carica();
      return true;
    },

    async backupDelGiorno() {
      const giorno = oggi().replace(/-/g, '');
      if (localStorage.getItem('giardino_backup') === giorno) return;
      const percorso = `${CONFIG.CARTELLA_BACKUP}/giardino_${giorno}.json`;
      try {
        if (!await Dropbox.esiste(percorso)) await Dropbox.carica(percorso, this.serializza(this.d), null);
      } catch (e) {
        if (!e.conflitto) throw e;
      }
      try { localStorage.setItem('giardino_backup', giorno); } catch (e) { /* */ }
    },

    // fn(d) modifica una copia dei dati; se il PC ha salvato nel frattempo si rilegge il file e si riapplica fn
    async modifica(fn) {
      if (this.daCache) await this.carica();
      await this.backupDelGiorno();
      for (let tentativo = 0; tentativo < 4; tentativo++) {
        const copia = structuredClone(this.d);
        const ris = fn(copia);
        try {
          this.rev = await Dropbox.carica(CONFIG.FILE_DATI, this.serializza(copia), this.rev);
          this.d = copia;
          this.letto = Date.now();
          this.salvaCache();
          return ris;
        } catch (e) {
          if (!e.conflitto) throw e;
          await this.carica();  // dati nuovi dal PC: si riprova su quelli
        }
      }
      throw new Error('Il file continua a cambiare: riprova tra qualche secondo.');
    },
  };

  window.Giardino = {
    MESI, MESI_LUNGHI, TIPI_ATTIVITA, CATEGORIE, TIPI_ZONA, TAGLIE, CAMPI_TESTO,
    oggi, meseCorrente, annoCorrente, nuovoId, dataPerMese, fmtOre, stimaMinuti, completaTempi,
    areaPoligono, centroPoligono, dentro, rettangolo, normalizza, Q, Mod, Archivio: ArchivioDbx,
  };
})();
