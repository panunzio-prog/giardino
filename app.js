// Avvio, collegamento a Dropbox, navigazione tra le pagine e funzioni comuni dell'interfaccia.
(function () {
  const G = window.Giardino;
  const A = G.Archivio;
  const { Q, TIPI_ATTIVITA } = G;
  const main = document.getElementById('contenuto');
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TITOLI = { mappa: 'Mappa', fare: 'Da fare', schede: 'Schede', scheda: 'Scheda', diario: 'Diario', meteo: 'Meteo' };

  // ------------------------------------------------------------- interfaccia
  let chiusuraFoglio = null;
  let timerAvviso = null;
  const UI = {
    iconaSpecie(s, px = 28) {
      const ic = s && window.ICONE && window.ICONE[s.id];
      if (ic) return `<svg viewBox="0 0 64 64" width="${px}" height="${px}" style="flex-shrink:0;vertical-align:middle">${ic}</svg>`;
      return `<span style="font-size:${Math.round(px * 0.8)}px;line-height:1;flex-shrink:0">${esc((s && s.icona) || '🌱')}</span>`;
    },

    foglio(html, alMontaggio, allaChiusura) {
      const f = document.getElementById('foglio');
      f.innerHTML = '<div class="maniglia"></div><button class="chiudi" aria-label="Chiudi">✕</button>' + html;
      f.classList.remove('nascosto');
      document.getElementById('foglio-sfondo').classList.remove('nascosto');
      chiusuraFoglio = allaChiusura || null;
      f.querySelector('.chiudi').onclick = () => UI.chiudiFoglio();
      f.scrollTop = 0;
      if (alMontaggio) alMontaggio(f);
    },
    chiudiFoglio(senzaCallback) {
      document.getElementById('foglio').classList.add('nascosto');
      document.getElementById('foglio-sfondo').classList.add('nascosto');
      const cb = chiusuraFoglio;
      chiusuraFoglio = null;
      if (cb && !senzaCallback) cb();
    },
    foglioAperto: () => !document.getElementById('foglio').classList.contains('nascosto'),

    avviso(testo, errore = false) {
      const el = document.getElementById('avviso');
      el.textContent = testo;
      el.className = errore ? 'errore' : '';
      clearTimeout(timerAvviso);
      timerAvviso = setTimeout(() => el.classList.add('nascosto'), errore ? 5000 : 2200);
    },

    occupato(si) {
      document.getElementById('btn-aggiorna').classList.toggle('gira', !!si);
    },

    // applica una modifica e la salva su Dropbox. true se è andata a buon fine.
    async salva(fn, messaggio) {
      UI.occupato(true);
      const revPrima = A.rev;
      try {
        let conflitto = false;
        await A.modifica(dd => {
          if (A.rev !== revPrima) conflitto = true;
          return fn(dd);
        });
        aggiornaStato();
        UI.avviso(conflitto ? 'Salvato (dati aggiornati dal PC nel frattempo)' : (messaggio || 'Salvato'));
        return true;
      } catch (e) {
        gestisciErrore(e, 'Non salvato');
        return false;
      } finally {
        UI.occupato(false);
      }
    },

    // registra un intervento o un raccolto nel diario
    dialogoDiario({ pianta_id = '', specie_id = '', tipo = 'altro', descrizione = '' }) {
      const d = A.d;
      const piante = [...d.piante].filter(p => !specie_id || p.specie_id === specie_id)
        .sort((a, b) => Q.nomePianta(d, a).localeCompare(Q.nomePianta(d, b)));
      const sp = specie_id && Q.specie(d, specie_id);
      const h = '<h2>Registra intervento</h2>' +
        `<label class="campo">Data<input id="r-data" type="date" value="${G.oggi()}"></label>` +
        '<label class="campo">Tipo<select id="r-tipo">' +
        Object.entries(TIPI_ATTIVITA).map(([k, t]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${t.emoji} ${t.label}</option>`).join('') +
        '</select></label><label class="campo">Pianta<select id="r-pianta"><option value="">' + (sp ? esc(sp.nome) + ' (tutte)' : '—') + '</option>' +
        piante.map(p => `<option value="${p.id}" ${p.id === pianta_id ? 'selected' : ''}>${esc(Q.nomePianta(d, p))}</option>`).join('') +
        `</select></label><label class="campo">Descrizione<textarea id="r-desc">${esc(descrizione)}</textarea></label>` +
        '<label class="campo">Prodotto<input id="r-prod"></label><label class="campo">Quantità / dose<input id="r-q"></label>' +
        '<label class="campo" id="r-kg-box">Raccolto (kg)<input id="r-kg" type="text" inputmode="decimal" placeholder="es. 1,5"></label>' +
        '<button class="btn" id="r-ok" style="width:100%;margin-top:8px">💾 Salva</button>';
      const prima = chiusuraFoglio;
      UI.foglio(h, f => {
        const kgBox = f.querySelector('#r-kg-box');
        const t = f.querySelector('#r-tipo');
        const vedi = () => kgBox.classList.toggle('nascosto', t.value !== 'raccolta');
        t.onchange = vedi; vedi();
        f.querySelector('#r-ok').onclick = async () => {
          const tipoV = t.value;
          const kg = parseFloat(String(f.querySelector('#r-kg').value).replace(',', '.'));
          const dati = {
            tipo: tipoV, descrizione: f.querySelector('#r-desc').value.trim() || TIPI_ATTIVITA[tipoV].label,
            pianta_id: f.querySelector('#r-pianta').value, specie_id, data: f.querySelector('#r-data').value || G.oggi(),
            prodotto: f.querySelector('#r-prod').value, quantita: f.querySelector('#r-q').value,
            kg: tipoV === 'raccolta' && kg > 0 ? kg : null,
          };
          if (await UI.salva(dd => G.Mod.registra(dd, dati), 'Intervento registrato')) {
            UI.chiudiFoglio();
            mostra();
          }
        };
      }, prima);
    },
  };
  window.UI = UI;
  document.getElementById('foglio-sfondo').onclick = () => UI.chiudiFoglio();

  function gestisciErrore(e, prefisso) {
    console.error(e);
    if (e && e.stato === 401) { UI.avviso('Accesso a Dropbox scaduto: collegalo di nuovo', true); schermataLogin(); return; }
    const offline = !navigator.onLine || (e && e.name === 'TypeError');
    UI.avviso(`${prefisso}: ${offline ? 'nessuna connessione' : (e && e.message) || e}`, true);
  }

  function aggiornaStato() {
    const el = document.getElementById('stato');
    if (!A.d) { el.textContent = ''; return; }
    if (A.daCache) { el.textContent = '⚠ offline'; return; }
    const ora = new Date(A.letto);
    el.textContent = `agg. ${String(ora.getHours()).padStart(2, '0')}:${String(ora.getMinutes()).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------------ pagine
  function mostra() {
    if (!A.d) return;
    const [nome, arg] = (location.hash.slice(1) || 'mappa').split('/');
    const pagina = TITOLI[nome] ? nome : 'mappa';
    document.querySelectorAll('#schede-nav a').forEach(a => a.classList.toggle('attiva',
      a.dataset.p === pagina || (pagina === 'scheda' && a.dataset.p === 'schede')));
    document.getElementById('titolo-pagina').textContent = TITOLI[pagina];
    document.getElementById('schede-nav').classList.remove('nascosto');
    Grafici.liberaTutti();
    main.className = '';
    main.innerHTML = '';
    if (UI.foglioAperto()) UI.chiudiFoglio(true);
    window.scrollTo(0, 0);
    if (pagina === 'mappa') {
      Mappa.render(main);
      if (arg && Q.pianta(A.d, arg)) { Mappa.mostra(arg); Mappa.ridisegna(); Mappa.apriPianta(arg); }
    } else if (pagina === 'scheda') Pagine.scheda(main, arg);
    else Pagine[pagina](main, arg);
  }
  window.addEventListener('hashchange', mostra);

  // ridisegna dopo che sono arrivati dati nuovi, senza perdere un modulo che si sta compilando
  function dopoAggiornamento() {
    if (document.getElementById('nota-mod') || UI.foglioAperto()) {
      UI.avviso('Dati aggiornati dal PC');
      return;
    }
    const y = window.scrollY;
    mostra();
    window.scrollTo(0, y);
    UI.avviso('Dati aggiornati dal PC');
  }

  let controlloInCorso = false;
  async function controllaAggiornamenti(forza) {
    if (controlloInCorso || !Dropbox.collegato() || !A.d) return;
    if (!forza && Date.now() - A.letto < 15000) return;
    controlloInCorso = true;
    UI.occupato(true);
    try {
      const nuovi = await A.aggiornaSeCambiato();
      aggiornaStato();
      if (nuovi) dopoAggiornamento();
      else if (forza) UI.avviso('Già aggiornato');
    } catch (e) {
      if (forza) gestisciErrore(e, 'Aggiornamento non riuscito');
      aggiornaStato();
    } finally {
      controlloInCorso = false;
      UI.occupato(false);
    }
  }
  document.getElementById('btn-aggiorna').onclick = () => controllaAggiornamenti(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controllaAggiornamenti(false); });
  setInterval(() => { if (document.visibilityState === 'visible') controllaAggiornamenti(false); }, 30000);

  // ------------------------------------------------------------------- login
  function schermataLogin() {
    document.getElementById('schede-nav').classList.add('nascosto');
    document.getElementById('titolo-pagina').textContent = 'Il mio giardino';
    main.className = '';
    if (!CONFIG.DROPBOX_APP_KEY || CONFIG.DROPBOX_APP_KEY.startsWith('METTI')) {
      main.innerHTML = '<div class="login card"><h2>Manca la App key di Dropbox</h2><p>Scrivila nel file <b>config.js</b> ' +
        '(vedi Giardino_iPhone_istruzioni.txt, punto 1 e 3) e ricarica la pagina su GitHub.</p></div>';
      return;
    }
    main.innerHTML = '<div class="login card"><h2>Collega Dropbox</h2>' +
      '<p>L\'app legge e salva i dati nello stesso file del PC: <b>Dropbox/Giardino/dati/giardino.json</b>.</p><ol>' +
      '<li><button class="btn" id="l-apri">1. Apri Dropbox</button><br><span class="piccolo">Accedi, premi <b>Consenti</b> e copia il codice che compare. ' +
      'Poi premi <b>Fine</b> in alto a sinistra per tornare qui.</span></li>' +
      '<li><label class="campo">2. Incolla qui il codice<input id="l-codice" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
      '<button class="btn" id="l-ok" style="width:100%">Collega</button></li></ol></div>';
    main.querySelector('#l-apri').onclick = async () => {
      const url = await Dropbox.indirizzoLogin();
      window.open(url, '_blank') || (location.href = url);
    };
    main.querySelector('#l-ok').onclick = async () => {
      const c = main.querySelector('#l-codice').value.trim();
      if (!c) { UI.avviso('Incolla il codice di Dropbox', true); return; }
      UI.occupato(true);
      try {
        await Dropbox.completaLogin(c);
        await A.carica();
        UI.avviso('Dropbox collegato ✓');
        aggiornaStato();
        location.hash = '#mappa';
        mostra();
      } catch (e) {
        gestisciErrore(e, 'Collegamento non riuscito');
      } finally {
        UI.occupato(false);
      }
    };
  }

  // ------------------------------------------------------------------- avvio
  async function avvio() {
    if (!Dropbox.collegato()) { schermataLogin(); return; }
    if (A.caricaDaCache()) { aggiornaStato(); mostra(); } else {
      main.innerHTML = '<div class="vuoto">Carico i dati da Dropbox…</div>';
    }
    UI.occupato(true);
    try {
      const primaVolta = !A.d;
      const revCache = A.rev;
      await A.carica();
      aggiornaStato();
      if (primaVolta || A.rev !== revCache) mostra();
    } catch (e) {
      if (e && e.stato === 409) {
        main.innerHTML = '<div class="login card"><h2>File dati non trovato</h2><p>Non trovo <b>' + esc(CONFIG.FILE_DATI) +
          '</b> nel tuo Dropbox. Controlla che la cartella Giardino sia nella radice di Dropbox (vedi istruzioni).</p></div>';
      } else if (A.d) {
        UI.avviso('Senza connessione: vedi i dati dell\'ultima apertura (sola lettura)', true);
      } else gestisciErrore(e, 'Dati non caricati');
    } finally {
      UI.occupato(false);
    }
  }
  avvio();
})();
