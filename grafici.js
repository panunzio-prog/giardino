// Grafici con ECharts (la stessa libreria usata dall'app del PC), caricata solo quando serve.
(function () {
  const COL = {
    GRIGIO_ASSI: '#8a9a8e', LINEE: 'rgba(128,128,128,.15)',
    PIOGGIA: '#3b82c4', SOLE: '#e9a23b', TMAX: '#d9480f', TMIN: '#5c6bc0', GDD: '#8d6e3f', ACQUA: '#2a9d8f',
    PREC: '#9c7bb8', MEDIA: '#7a8a7e',
  };
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  let caricamento = null;
  const attivi = new Set();

  function carica() {
    if (window.echarts) return Promise.resolve();
    if (!caricamento) {
      caricamento = new Promise((ok, ko) => {
        const s = document.createElement('script');
        s.src = 'lib/echarts.min.js?v=5.5.1';
        s.onload = ok;
        s.onerror = () => { caricamento = null; s.remove(); ko(new Error('Grafici non caricati (sei offline?)')); };
        document.head.appendChild(s);
      });
    }
    return caricamento;
  }

  const scuro = () => window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;

  function base() {
    return {
      backgroundColor: 'transparent',
      textStyle: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
      animationDuration: 400,
    };
  }

  // disegna (o ridisegna) un grafico nell'elemento; restituisce l'istanza
  async function disegna(el, opzioni) {
    if (!el) return null;
    try { await carica(); } catch (e) {
      el.innerHTML = `<div class="vuoto">${e.message}</div>`;
      return null;
    }
    if (!el.isConnected) return null;
    let c = echarts.getInstanceByDom(el);
    if (!c) { c = echarts.init(el, null, { renderer: 'canvas' }); attivi.add(c); }
    c.setOption(Object.assign(base(), opzioni), true);
    return c;
  }

  function liberaTutti() {
    attivi.forEach(c => { try { c.dispose(); } catch (e) { /* */ } });
    attivi.clear();
  }
  window.addEventListener('resize', () => attivi.forEach(c => c.resize()));

  function tooltip(extra) {
    return Object.assign({
      trigger: 'axis', confine: true,
      backgroundColor: scuro() ? 'rgba(29,34,30,.96)' : 'rgba(255,255,255,.97)',
      borderColor: scuro() ? '#2f372f' : '#dfe5dc',
      textStyle: { color: scuro() ? '#e6ece5' : '#1f2a20', fontSize: 12 },
    }, extra || {});
  }
  function legenda(dati, extra) {
    return Object.assign({ top: 0, type: 'scroll', data: dati, textStyle: { color: COL.GRIGIO_ASSI, fontSize: 11 },
      itemWidth: 14, itemHeight: 9, pageIconColor: COL.GRIGIO_ASSI, pageTextStyle: { color: COL.GRIGIO_ASSI } }, extra || {});
  }
  function asseY(nome, destra) {
    return { type: 'value', name: nome, position: destra ? 'right' : 'left',
      nameTextStyle: { color: COL.GRIGIO_ASSI, fontSize: 10 }, axisLabel: { color: COL.GRIGIO_ASSI, fontSize: 10 },
      splitLine: { show: !destra, lineStyle: { color: COL.LINEE } } };
  }
  // asse dei tempi con i nomi dei mesi (o giorno + mese per periodi brevi)
  function asseTempo(giorni) {
    const fmt = giorni > 70
      ? v => { const d = new Date(v); return MESI[d.getMonth()] + (d.getMonth() === 0 ? ' ' + d.getFullYear() : ''); }
      : v => { const d = new Date(v); return d.getDate() + ' ' + MESI[d.getMonth()]; };
    return { type: 'time', axisLabel: { color: COL.GRIGIO_ASSI, formatter: fmt, hideOverlap: true, fontSize: 10 },
      splitNumber: 6, minInterval: 86400000, axisLine: { lineStyle: { color: COL.LINEE } },
      splitLine: { show: true, lineStyle: { color: COL.LINEE } } };
  }
  const fmt1 = v => (v === null || v === undefined) ? '–' : Number(v).toFixed(1).replace('.', ',');

  window.Grafici = { carica, disegna, liberaTutti, COL, MESI, tooltip, legenda, asseY, asseTempo, fmt1 };
})();
