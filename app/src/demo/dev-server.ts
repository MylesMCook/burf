// demoDevServer is the page the live demo shows for a box's dev server,
// which it doesn't have: a plain, unbranded billing page for the
// billing-fix worktree, drawn in place so nothing loads from anywhere.
export function demoDevServer(url: string): string {
  const port = /^https?:\/\/(\d+)\./.exec(url)?.[1] ?? "3001";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:14px/1.5 system-ui,-apple-system,sans-serif;background:#f6f6f4;color:#222}
header{display:flex;align-items:center;gap:10px;padding:14px 28px;border-bottom:1px solid #e4e4e4;background:#fff}
header b{font-size:15px} header span{color:#888;font-size:13px}
main{padding:28px;max-width:560px} h1{font-size:20px;margin:0 0 4px} p{color:#666;margin:0 0 20px}
.card{background:#fff;border:1px solid #e4e4e4;border-radius:10px;padding:18px 20px;margin-bottom:14px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}.row:last-child{border:0}
.price{font-size:26px;font-weight:600}.tag{display:inline-block;background:#eef6ee;color:#1f7a3a;border-radius:99px;padding:2px 10px;font-size:12px;margin-left:8px;vertical-align:middle}
small{color:#888}</style></head><body><header><b>Billing</b><span>localhost:${port} · dev</span></header><main>
<h1>Team plan</h1><p>Billed yearly · renews 14 March</p>
<div class="card"><div class="price">€1,200.00 <small>/ year</small><span class="tag">EUR</span></div></div>
<div class="card"><div class="row"><span>Invoice 0042</span><span>€1,200.00</span></div><div class="row"><span>Invoice 0031</span><span>€1,200.00</span></div><div class="row"><span>Invoice 0019</span><span>€960.00</span></div></div>
</main></body></html>`;
}
