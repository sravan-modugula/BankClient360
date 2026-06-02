// attachStreamlitProxy.ts
import type { Express, NextFunction, Request, Response } from "express";
import type { Server, IncomingMessage } from "http";
import http from "http";
import net from "net";
import type { Socket } from "net";
import { requireAuth } from "./middleware/requireAuth";


export type AttachStreamlitProxyOptions = {
  app: Express;
  server: Server;
  route?: string;
  targetHost?: string;
  targetPort?: number;
};


export function attachStreamlitProxy({
  app,
  server,
  route = "/streamlit",
  targetHost = "127.0.0.1",
  targetPort = 8501,
}: AttachStreamlitProxyOptions): void {
  if (!app) throw new Error("app is required");
  if (!server) throw new Error("server is required");
  // if (!authenticateRequest) throw new Error("authenticateRequest is required");

  function isProxyPath(url: string | undefined): boolean {
    if (!url) return false;
    return url === route || url.startsWith(`${route}/`);
  }

  // app.use(route, requireAuth, (req: Request, res: Response) => {
  app.use(route, (req: Request, res: Response) => {
    const headers: http.OutgoingHttpHeaders = {
      ...req.headers,
      "x-forwarded-host": req.headers.host,
      "x-forwarded-proto": req.protocol,
    };

    if (req.session?.employeeId) {
      headers["x-authenticated-user-id"] = req.session?.employeeId;
    }

    const proxyReq = http.request(
      {
        hostname: targetHost,
        port: targetPort,
        method: req.method,
        path: req.originalUrl,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    req.pipe(proxyReq);

    proxyReq.on("error", (err: Error) => {
      console.error("Streamlit HTTP proxy error:", err);

      if (!res.headersSent) {
        res.status(502);
      }

      res.end("Bad gateway");
    });
  });

  server.on("upgrade", async (
    req: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => {
    if (!isProxyPath(req.url)) {
      return;
    }

    try {
      // const user = await authenticateRequest(req);

      // if (!user) {
      //   socket.write(
      //     "HTTP/1.1 401 Unauthorized\r\n" +
      //       "Connection: close\r\n" +
      //       "\r\n"
      //   );
      //   socket.destroy();
      //   return;
      // }

      const targetSocket = net.connect(targetPort, targetHost, () => {
        const headerLines: string[] = [
          `GET ${req.url} HTTP/1.1`,
          `Host: ${targetHost}:${targetPort}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
        ];

        for (const [key, value] of Object.entries(req.headers)) {
          const lower = key.toLowerCase();

          if (
            lower === "host" ||
            lower === "connection" ||
            lower === "upgrade"
          ) {
            continue;
          }

          if (Array.isArray(value)) {
            for (const item of value) {
              headerLines.push(`${key}: ${item}`);
            }
          } else if (value !== undefined) {
            headerLines.push(`${key}: ${value}`);
          }
        }

        // if (user.userId) {
        //   headerLines.push(`x-authenticated-user-id: ${user.userId}`);
        // }

        headerLines.push("\r\n");

        targetSocket.write(headerLines.join("\r\n"));
        targetSocket.write(head);

        targetSocket.pipe(socket);
        socket.pipe(targetSocket);
      });

      targetSocket.on("error", () => {
        socket.destroy();
      });

      socket.on("error", () => {
        targetSocket.destroy();
      });
    } catch {
      socket.write(
        "HTTP/1.1 500 Internal Server Error\r\n" +
          "Connection: close\r\n" +
          "\r\n"
      );
      socket.destroy();
    }
  });
}