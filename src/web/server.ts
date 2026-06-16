import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { LanceDBStore } from "../vectorstore/lancedb.js";
import { KeywordIndex } from "../retriever/keyword-index.js";
import { createApiHandler } from "./api.js";
import { getStaticHtml } from "./static.js";

function serveStatic(res: ServerResponse, html: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

export interface WebUiServer {
  port: number;
  close: () => Promise<void>;
}

export async function startWebUi(
  storePath: string,
  port: number,
  vectorDimension: number = 384
): Promise<WebUiServer> {
  const store = new LanceDBStore(storePath, vectorDimension);
  const keywordIndex = await KeywordIndex.load(storePath);

  const html = getStaticHtml();
  const apiHandler = createApiHandler(store, keywordIndex);

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";

    if (url === "/" || url === "/index.html") {
      serveStatic(res, html);
      return;
    }

    if (url.startsWith("/api/")) {
      const handled = await apiHandler(req, res);
      if (handled) return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        port,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      });
    });
  });
}
