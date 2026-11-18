// BoG V · player sign-in (P3-4, locked Nov 11, 2026: "All recommended"). Players sign in with Google; the GM
// links each Google uid to a seat (gm link <uid> <pid> → bog5/members/{uid} = {pid}); the rules map auth.uid → pid.
//
// Two backends, same token shape ({ uid, email, name, idToken, refreshToken, exp, provider:'google.com' })
// and the same RtdbRest hook (`restAuth()` → { query: { auth: idToken } }):
//   • emulator (`?store=emulator`) — Auth emulator, fake Google account (no live config used)
//   • live (`?store=live`) — Firebase JS SDK from the official gstatic CDN (ES modules, no bundler):
//     signInWithPopup(GoogleAuthProvider), redirect fallback if the popup is blocked
// The live RTDB switch stays off: this module never reads or writes c-thug's database. Seat lookup and
// table data wait for a later sign-off (`allowLive` / BOG5_ALLOW_LIVE are not set here).
const SS = globalThis.sessionStorage; const KEY = 'bog5/auth';
export const EMULATOR = { auth: 'http://127.0.0.1:9099', rtdb: 'http://127.0.0.1:9000', ns: 'c-thug-default-rtdb', apiKey: 'demo-key-emulator-only' };
// Public web-app config (Firebase project c-thug, app "bog5"). No measurementId is included; Analytics is not loaded.
export const LIVE_CONFIG = {
  apiKey: 'AIzaSyAvJB0EXM5t0otCkiQFaq4uYy_OaMyxJMo',
  authDomain: 'c-thug.firebaseapp.com',
  databaseURL: 'https://c-thug-default-rtdb.firebaseio.com',
  projectId: 'c-thug',
  storageBucket: 'c-thug.firebasestorage.app',
  messagingSenderId: '710564417946',
  appId: '1:710564417946:web:2ac9686eef82f235d62a23',
};
// Pinned Nov 17, 2026 — current firebase npm latest, both modules 200 on gstatic.
export const FIREBASE_JS = '13.4.0';
const sdkUrl = name => `https://www.gstatic.com/firebasejs/${FIREBASE_JS}/${name}`;
export async function loadFirebaseSdk() {
  const [app, auth] = await Promise.all([import(sdkUrl('firebase-app.js')), import(sdkUrl('firebase-auth.js'))]);
  return { ...app, ...auth };
}
const popupBlocked = e => {
  const code = e?.code || '';
  return code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment'
    || /popup was blocked|popup blocked|window\.open/i.test(e?.message || '');
};

export class GoogleAuth {
  constructor({ emulator = EMULATOR, live = null, fetch: f = globalThis.fetch?.bind(globalThis), storage = SS, loadSdk = null } = {}) {
    this.emu = live ? null : emulator; this.live = live || null; this.fetch = f; this.ss = storage; this.loadSdk = loadSdk;
    this.user = null; this._sdk = null; this._auth = null; this._ready = null;
    try { if (!this.live) this.user = JSON.parse(this.ss?.getItem(KEY) || 'null'); } catch { this.user = null; }
  }
  get signedIn() { return !!this.user?.idToken; }
  _save(u) { this.user = u; try { u ? this.ss?.setItem(KEY, JSON.stringify(u)) : this.ss?.removeItem(KEY); } catch {} return u; }
  async _post(url, body, form = false) {
    const r = await this.fetch(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `sign-in failed (${r.status})`); return j;
  }
  async ready() {
    if (!this.live) return this;
    if (this._ready) return this._ready;
    this._ready = this._initLive();
    try { await this._ready; } catch (e) { this._ready = null; throw e; }
    return this;
  }
  async _initLive() {
    const sdk = this._sdk = await (this.loadSdk || loadFirebaseSdk)();
    const apps = sdk.getApps();
    const app = apps.length ? sdk.getApp() : sdk.initializeApp(this.live);
    this._auth = sdk.getAuth(app);
    let redirectErr = null;
    try {
      const cred = await sdk.getRedirectResult(this._auth);
      if (cred?.user) await this._fromFirebaseUser(cred.user);
    } catch (e) { redirectErr = e; }
    await new Promise((resolve, reject) => {
      let settled = false;
      const unsub = sdk.onAuthStateChanged(this._auth, async user => {
        if (settled) return;
        try {
          if (user) await this._fromFirebaseUser(user);
          else if (!this.signedIn) this._save(null);
          settled = true; unsub(); resolve();
        } catch (e) { settled = true; unsub(); reject(e); }
      }, e => { if (!settled) { settled = true; unsub(); reject(e); } });
    });
    if (redirectErr && !this.signedIn) throw redirectErr;
    return this;
  }
  async _fromFirebaseUser(user) {
    if (!user) return this._save(null);
    const idToken = await user.getIdToken();
    let exp = Date.now() + 3600e3;
    if (typeof user.getIdTokenResult === 'function') {
      const r = await user.getIdTokenResult();
      if (r?.expirationTime) exp = Date.parse(r.expirationTime) || exp;
    }
    return this._save({
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '',
      idToken,
      refreshToken: user.refreshToken || '',
      exp,
      provider: 'google.com',
    });
  }
  // Emulator: unsigned fake Google token. Live: popup, or redirect if the popup is blocked.
  async signInWithGoogle({ email, name = '' } = {}) {
    if (this.live) {
      await this.ready();
      const sdk = this._sdk, provider = new sdk.GoogleAuthProvider();
      try {
        const cred = await sdk.signInWithPopup(this._auth, provider);
        return this._fromFirebaseUser(cred.user);
      } catch (e) {
        if (!popupBlocked(e)) throw e;
        await sdk.signInWithRedirect(this._auth, provider);
        return null; // the page is navigating away
      }
    }
    if (!this.emu) throw new Error('Google sign-in is not configured for live yet (go-live checklist).');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw new Error('enter the Google email to sign in as');
    const sub = 'google-' + [...email.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
    const idTok = JSON.stringify({ sub, email, email_verified: true, name });
    const j = await this._post(`${this.emu.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${this.emu.apiKey}`, { postBody: `id_token=${encodeURIComponent(idTok)}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: true });
    return this._save({ uid: j.localId, email: j.email || email, name: j.displayName || name, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000, provider: 'google.com' });
  }
  async token() {
    if (this.live) {
      await this.ready();
      const u = this._auth?.currentUser;
      if (!u) { this._save(null); return null; }
      return (await this._fromFirebaseUser(u)).idToken;
    }
    if (!this.user) return null; if (Date.now() < this.user.exp - 60e3) return this.user.idToken;
    const j = await this._post(`${this.emu.auth}/securetoken.googleapis.com/v1/token?key=${this.emu.apiKey}`, { grant_type: 'refresh_token', refresh_token: this.user.refreshToken }, true);
    return this._save({ ...this.user, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (+j.expires_in || 3600) * 1000 }).idToken;
  }
  async signOut() {
    if (this.live) {
      try { await this.ready(); if (this._sdk && this._auth) await this._sdk.signOut(this._auth); } catch {}
    }
    this._save(null);
  }
  // RtdbRest auth hook: the RTDB emulator (and live RTDB) accept a Firebase ID token as ?auth=
  restAuth() { return async () => { const t = await this.token(); return t ? { query: { auth: t } } : null; }; }
  // which seat is this Google account? (members/{uid} is readable by that uid only)
  // Live: do not call this with a live RtdbRest until the live database switch is on.
  async seat(rest) { if (!this.user) return null; const m = await rest.get(['members', this.user.uid]).catch(() => null); return m?.pid || null; }
}
