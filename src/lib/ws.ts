/**
 * Cliente WebSocket para endpoints de Dokploy.
 * Soporta autenticación via x-api-key en el upgrade request.
 */

import WebSocket from "ws";
import { getProfile, type DokployConfig } from "./client.js";

export interface WsOptions {
  path: string;
  params?: Record<string, string>;
  onMessage: (data: string) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
  config?: DokployConfig;
}

export function connectWs(opts: WsOptions): WebSocket {
  const cfg = opts.config ?? getProfile();
  const base = cfg.url.replace(/^http/, "ws").replace(/\/$/, "");

  const params = new URLSearchParams(opts.params ?? {});
  const url = `${base}${opts.path}?${params.toString()}`;

  const ws = new WebSocket(url, {
    headers: {
      "x-api-key": cfg.apiKey,
    },
  });

  ws.on("message", (raw) => {
    opts.onMessage(raw.toString());
  });

  ws.on("close", () => {
    opts.onClose?.();
  });

  ws.on("error", (err) => {
    opts.onError?.(err);
  });

  return ws;
}

/**
 * Conecta a un WebSocket y devuelve una promesa que resuelve al cerrar.
 * Útil para streaming de logs.
 */
export function streamWs(opts: WsOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = connectWs({
      ...opts,
      onClose: () => {
        opts.onClose?.();
        resolve();
      },
      onError: (err) => {
        opts.onError?.(err);
        reject(err);
      },
    });

    // Ctrl+C limpia la conexión
    process.on("SIGINT", () => {
      ws.close();
      resolve();
    });
  });
}

/**
 * Conecta a un WebSocket bidireccional (terminal interactiva).
 * Redirige stdin al WS y WS stdout a la terminal.
 */
export function interactiveWs(opts: Omit<WsOptions, "onMessage">): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = connectWs({
      ...opts,
      onMessage: (data) => {
        process.stdout.write(data);
      },
      onClose: () => {
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        opts.onClose?.();
        resolve();
      },
      onError: (err) => {
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        opts.onError?.(err);
        reject(err);
      },
    });

    ws.on("open", () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on("data", (chunk) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk.toString());
        }
      });
    });

    process.on("SIGINT", () => {
      ws.close();
    });
  });
}
