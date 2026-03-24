import { Command } from "commander";
import { interactiveWs } from "../lib/ws.js";
import { heading, error, info, warn } from "../lib/output.js";

export const execCmd = new Command("exec")
  .description("Ejecutar shell interactiva en un contenedor Docker")
  .argument("<containerId>", "ID o nombre del contenedor")
  .option("--shell <shell>", "Shell a usar (sh, bash, zsh, ash)", "sh")
  .option("-s, --server <serverId>", "ID del servidor")
  .action(async (containerId, opts) => {
    const allowedShells = ["sh", "bash", "zsh", "ash", "/bin/sh", "/bin/bash", "/bin/zsh", "/bin/ash"];
    if (!allowedShells.includes(opts.shell)) {
      error(`Shell no permitida: ${opts.shell}`);
      info(`  Shells válidas: ${allowedShells.join(", ")}`);
      return;
    }

    heading(`Conectando a ${containerId} (${opts.shell})`);
    warn("Sesión interactiva — Ctrl+C o 'exit' para salir");
    console.log();

    try {
      await interactiveWs({
        path: "/docker-container-terminal",
        params: {
          containerId,
          activeWay: opts.shell,
          ...(opts.server ? { serverId: opts.server } : {}),
        },
        onClose: () => {
          console.log("\n--- Sesión cerrada ---");
        },
      });
    } catch (err: any) {
      error(`Conexión fallida: ${err.message}`);
    }
  });
