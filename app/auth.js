// BoG V · player sign-in (P3-4, locked Nov 11, 2026: "All recommended"). Players sign in with Google; the GM
// links each Google uid to a seat (gm link <uid> <pid> → bog5/members/{uid} = {pid}); the rules map auth.uid → pid.
// This pass runs ONLY against the Firebase Auth + RTDB emulators (project demo-c-thug). No live config exists
// here: the live path needs the web app config and an authorized domain, which are go-live checklist items.
const SS = globalThis.sessionStorage; const KEY = 'bog5/auth';
export const EMULATOR = { auth: 'http://127.0.0.1:9099', rtdb: 'http://127.0.0.1:9000', ns: 'c-thug-default-rtdb', apiKey: 'demo-key-emulator-only' };
export class GoogleAuth {
  constructor({ emulator = EMULATOR, live = null, fetch: f = globalThis.fetch?.bind(globalThis), storage = SS } = {}) {
    this.emu = emulator; this.live = live; this.fetch = f; this.ss = storage; this.user = null;
    try { this.user = JSON.parse(this.ss?.getItem(KEY) || 'null'); } catch { this.user = null; }
  }
  get signedIn() { return !!this.user?.idToken; }
  _save(u) { this.user = u; try { u ? this.ss?.setItem(KEY, JSON.stringify(u)) : this.ss?.removeItem(KEY); } catch {} return u; }
  async _post(url, body, form = false) {
    const r = await this.fetch(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `sign-in failed (${r.status})`); return j;
  }
  // Emulator only: the Auth emulator accepts an unsigned Google ID token given as JSON (its fake account picker).
  async signInWithGoogle({ email, name = '' } = {}) {
    if (!this.emu) throw new Error('Google sign-in is not configured for live yet (go-live checklist).');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw new Error('enter the Google email to sign in as');
    const sub = 'google-' + [...email.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
    const idTok = JSON.stringify({ sub, email, email_verified: true, name });
    const j = await this._post(`${this.emu.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${this.emu.apiKey}`, { postBody: `id_token=${encodeURIComponent(idTok)}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: true });
    return this._save({ uid: j.localId, email: j.email || email, name: j.displayName || name, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000, provider: 'google.com' });
  }
  async token() {
    if (!this.user) return null; if (Date.now() < this.user.exp - 60e3) return this.user.idToken;
    const j = await this._post(`${this.emu.auth}/securetoken.googleapis.com/v1/token?key=${this.emu.apiKey}`, { grant_type: 'refresh_token', refresh_token: this.user.refreshToken }, true);
    return this._save({ ...this.user, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (+j.expires_in || 3600) * 1000 }).idToken;
  }
  signOut() { this._save(null); }
  // RtdbRest auth hook: the RTDB emulator (and live RTDB) accept a Firebase ID token as ?auth=
  restAuth() { return async () => { const t = await this.token(); return t ? { query: { auth: t } } : null; }; }
  // which seat is this Google account? (members/{uid} is readable by that uid only)
  async seat(rest) { if (!this.user) return null; const m = await rest.get(['members', this.user.uid]).catch(() => null); return m?.pid || null; }
}
