// Collegamento a Dropbox: login PKCE (senza segreti, con codice da copiare), lettura e scrittura del file dati.
// Il salvataggio usa la "rev" del file: se nel frattempo il PC lo ha cambiato, Dropbox rifiuta e si riprova
// sui dati nuovi (nessuna modifica va persa).
(function () {
  const K = { refresh: 'giardino_dbx_refresh', verifier: 'giardino_dbx_verifier' };
  let accessToken = null;
  let scadenza = 0;

  function leggi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* */ } }

  function b64url(bytes) {
    let s = '';
    bytes.forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // intestazione Dropbox-API-Arg: JSON con i caratteri non ASCII in \uXXXX
  function argJson(o) {
    return JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4));
  }

  function utf8(testo) { return new TextEncoder().encode(testo); }

  class ErroreDropbox extends Error {
    constructor(msg, stato, corpo) { super(msg); this.stato = stato; this.corpo = corpo || ''; }
  }

  const Dropbox = {
    ErroreDropbox,
    collegato() { return !!leggi(K.refresh); },

    // 1° passo: indirizzo della pagina di autorizzazione (Dropbox mostrerà un codice da copiare)
    async indirizzoLogin() {
      const v = b64url(crypto.getRandomValues(new Uint8Array(48)));
      scrivi(K.verifier, v);
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(v)));
      const q = new URLSearchParams({
        client_id: CONFIG.DROPBOX_APP_KEY, response_type: 'code', code_challenge: b64url(hash),
        code_challenge_method: 'S256', token_access_type: 'offline',
      });
      return 'https://www.dropbox.com/oauth2/authorize?' + q.toString();
    },

    // 2° passo: il codice incollato dall'utente diventa un "refresh token" che resta salvato sul telefono
    async completaLogin(codice) {
      const v = leggi(K.verifier);
      if (!v) throw new ErroreDropbox('Ripeti il collegamento dall\'inizio.');
      const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({ code: codice.trim(), grant_type: 'authorization_code',
          client_id: CONFIG.DROPBOX_APP_KEY, code_verifier: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.refresh_token) throw new ErroreDropbox('Codice non valido o scaduto: ripeti il collegamento.', r.status);
      scrivi(K.refresh, j.refresh_token);
      scrivi(K.verifier, null);
      accessToken = j.access_token;
      scadenza = Date.now() + (j.expires_in - 120) * 1000;
    },

    scollega() { scrivi(K.refresh, null); accessToken = null; },

    async token() {
      if (accessToken && Date.now() < scadenza) return accessToken;
      const rt = leggi(K.refresh);
      if (!rt) throw new ErroreDropbox('Non collegato a Dropbox', 401);
      const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: CONFIG.DROPBOX_APP_KEY }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 400 || r.status === 401) {
        this.scollega();
        throw new ErroreDropbox('Accesso a Dropbox scaduto: collegalo di nuovo.', 401);
      }
      if (!r.ok) throw new ErroreDropbox('Dropbox non risponde (' + r.status + ')', r.status);
      accessToken = j.access_token;
      scadenza = Date.now() + (j.expires_in - 120) * 1000;
      return accessToken;
    },

    async rpc(endpoint, arg) {
      const r = await fetch('https://api.dropboxapi.com/2/' + endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + await this.token(), 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });
      const t = await r.text();
      if (!r.ok) throw new ErroreDropbox('Errore Dropbox (' + r.status + ')', r.status, t);
      return JSON.parse(t);
    },

    // -> {testo, rev}
    async scarica(percorso) {
      const meta = await this.rpc('files/get_metadata', { path: percorso });
      const r = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + await this.token(), 'Dropbox-API-Arg': argJson({ path: 'rev:' + meta.rev }) },
      });
      if (!r.ok) throw new ErroreDropbox('Lettura non riuscita (' + r.status + ')', r.status, await r.text());
      const buf = await r.arrayBuffer();
      return { testo: new TextDecoder('utf-8').decode(buf), rev: meta.rev };
    },

    async rev(percorso) {
      return (await this.rpc('files/get_metadata', { path: percorso })).rev;
    },

    async esiste(percorso) {
      try { await this.rpc('files/get_metadata', { path: percorso }); return true; } catch (e) {
        if (e.stato === 409) return false;
        throw e;
      }
    },

    // rev = null -> crea solo se non esiste. Restituisce la nuova rev, oppure lancia {conflitto: true}.
    async carica(percorso, testo, rev) {
      const mode = rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' };
      const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + await this.token(),
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': argJson({ path: percorso, mode, autorename: false, mute: true, strict_conflict: true }),
        },
        body: utf8(testo),
      });
      const t = await r.text();
      if (r.status === 409) {
        const e = new ErroreDropbox('Il file è stato modificato altrove', 409, t);
        e.conflitto = true;
        throw e;
      }
      if (!r.ok) throw new ErroreDropbox('Salvataggio non riuscito (' + r.status + ')', r.status, t);
      return JSON.parse(t).rev;
    },
  };
  window.Dropbox = Dropbox;
})();
