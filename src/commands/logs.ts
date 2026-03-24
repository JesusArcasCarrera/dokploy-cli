import { Command } from "commander";
import { streamWs } from "../lib/ws.js";
import { heading, error, info } from "../lib/output.js";

export const logsCmd = new Command("logs")
  .alias("l")
  .description("Streaming de logs en tiempo real");

logsCmd
  .command("deployment <logPath>")
  .alias("dep")
  .description("Streaming de logs de un despliegue")
  .option("-s, --server <serverId>", "ID del servidor (para despliegues remotos)")
  .action(async (logPath, opts) => {
    heading("Logs de Despliegue (Ctrl+C para salir)");
    info(`  Path: ${logPath}`);
    console.log();

    try {
      await streamWs({
        path: "/listen-deployment",
        params: {
          logPath,
          ...(opts.server ? { serverId: opts.server } : {}),
        },
        onMessage: (data) => {
          process.stdout.write(data);
        },
        onClose: () => {
          console.log("\n--- Stream cerrado ---");
        },
      });
    } catch (err: any) {
      error(`Conexión fallida: ${err.message}`);
    }
  });

logsCmd
  .command("container <containerId>")
  .alias("c")
  .description("Streaming de logs de un contenedor Docker")
  .option("-t, --tail <lines>", "Número de líneas iniciales", "100")
  .option("--since <duration>", 'Desde cuándo: all, 5s, 10m, 1h, 2d', "all")
  .option("--search <text>", "Filtrar líneas (grep)")
  .option("-s, --server <serverId>", "ID del servidor")
  .option("--swarm", "Usar docker service logs en vez de container logs")
  .action(async (containerId, opts) => {
    heading(`Logs: ${containerId} (Ctrl+C para salir)`);
    console.log();

    try {
      await streamWs({
        path: "/docker-container-logs",
        params: {
          containerId,
          tail: opts.tail,
          since: opts.since,
          search: opts.search ?? "",
          ...(opts.server ? { serverId: opts.server } : {}),
          ...(opts.swarm ? { runType: "swarm" } : {}),
        },
        onMessage: (data) => {
          process.stdout.write(data);
        },
        onClose: () => {
          console.log("\n--- Stream cerrado ---");
        },
      });
    } catch (err: any) {
      error(`Conexión fallida: ${err.message}`);
    }
  });
