import { createServer } from "node:http";

import { greet } from "./greet.js";

// One page: a greeting, for ?name= or the world.
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><title>hello</title><h1>${escape(greet(url.searchParams.get("name")))}</h1>\n`);
});

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`hello on http://localhost:${port}`));
