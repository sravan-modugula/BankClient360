// attachStreamlitProxy.ts
import type { Express, NextFunction, Request, Response } from "express";
import type { IncomingMessage, Server } from "http";
import http from "http";
import https from "https";
import net from "net";
import tls from "tls";
import type { Socket } from "net";

type AuthenticatedUser = {
  userId?: string;
  [key: string]: unknown;
};

type AuthenticateRequest = (
  req: Request | IncomingMessage
) => Promise<AuthenticatedUser | null> | AuthenticatedUser | null;

type Options = {
  app: Express;
  server: Server;
  route?: string;
  streamlitUrl: string;
  // authenticateRequest: AuthenticateRequest;
};

export function attachStreamlitProxy({
  app,
  server,
  route = "/streamlit",
  streamlitUrl,
  // authenticateRequest,
}: Options): void {
  const target = new URL(streamlitUrl);
  const isHttps = target.protocol === "https:";
  const targetPort = Number(target.port || (isHttps ? 443 : 80));
  const targetHost = target.hostname;
  const targetOrigin = `${target.protocol}//${target.host}`;

  function isProxyPath(url?: string): boolean {
    return !!url && (url === route || url.startsWith(`${route}/`));
  }

  // async function requireAuth(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const user = await authenticateRequest(req);

  //     if (!user) {
  //       res.status(401).send("Unauthorized");
  //       return;
  //     }

  //     req.user = user;
  //     next();
  //   } catch (err) {
  //     next(err);
  //   }
  // }

  app.use(route, (req: Request, res: Response) => {
    const upstreamPath = req.originalUrl;

    const headers = {
      ...req.headers,

      // Critical when proxying to a URL-backed Streamlit host.
      host: target.host,

      // Useful if Streamlit or an upstream gateway checks origin/referrer.
      origin: targetOrigin,
      referer: `${targetOrigin}${upstreamPath}`,

      "x-forwarded-host": req.headers.host,
      "x-forwarded-proto": req.protocol,
    };

    delete headers["accept-encoding"];

    const requestImpl = isHttps ? https : http;

    const proxyReq = requestImpl.request(
      {
        protocol: target.protocol,
        hostname: targetHost,
        port: targetPort,
        method: req.method,
        path: upstreamPath,
        headers,
        servername: targetHost, // TLS SNI
      },
      (proxyRes) => {
        const responseHeaders = { ...proxyRes.headers };

        // Avoid iframe/proxy header conflicts.
        delete responseHeaders["content-security-policy"];
        delete responseHeaders["x-frame-options"];

        res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
        proxyRes.pipe(res);
      }
    );

    req.pipe(proxyReq);

    proxyReq.on("error", (err: NodeJS.ErrnoException) => {
      console.error("Streamlit HTTP proxy error:", {
        code: err.code,
        syscall: err.syscall,
        message: err.message,
        path: upstreamPath,
      });

      if (!res.headersSent) {
        res.status(502);
      }

      res.end("Bad gateway");
    });
  });

  server.on("upgrade", async (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (!isProxyPath(req.url)) return;

    try {
      // const user = await authenticateRequest(req);

      // if (!user) {
      //   socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      //   socket.destroy();
      //   return;
      // }

      const connectSocket = isHttps
        ? tls.connect({
            host: targetHost,
            port: targetPort,
            servername: targetHost,
          })
        : net.connect(targetPort, targetHost);

      connectSocket.once("connect", () => {
        const headerLines = [
          `${req.method} ${req.url} HTTP/1.1`,
          `Host: ${target.host}`,
        ];

        for (const [key, value] of Object.entries(req.headers)) {
          if (key.toLowerCase() === "host") continue;

          if (Array.isArray(value)) {
            for (const item of value) headerLines.push(`${key}: ${item}`);
          } else if (value !== undefined) {
            headerLines.push(`${key}: ${value}`);
          }
        }

        headerLines.push("\r\n");

        connectSocket.write(headerLines.join("\r\n"));
        connectSocket.write(head);

        connectSocket.pipe(socket);
        socket.pipe(connectSocket);
      });

      connectSocket.on("error", (err: NodeJS.ErrnoException) => {
        console.error("Streamlit WS proxy error:", {
          code: err.code,
          syscall: err.syscall,
          message: err.message,
          url: req.url,
        });

        socket.destroy();
      });

      socket.on("error", () => {
        connectSocket.destroy();
      });
    } catch {
      socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n");
      socket.destroy();
    }
  });
} 