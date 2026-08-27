export class Net {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = {};
  }
  on(type, cb) { this.handlers[type] = cb; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const h = this.handlers[msg.t];
        if (h) h(msg);
      };
      this.ws.onclose = () => { const h = this.handlers.__close; if (h) h(); };
    });
  }
  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
}
