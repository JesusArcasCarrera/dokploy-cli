import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, error, json, statusColor, truncate } from "../lib/output.js";
import ora from "ora";

export const dockerCmd = new Command("docker")
  .description("Operaciones Docker remotas");

dockerCmd
  .command("containers")
  .alias("ps")
  .description("Listar contenedores")
  .option("-s, --server <serverId>", "ID del servidor")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando contenedores...").start();
    try {
      const client = new DokployClient();
      const containers = await client.getContainers(opts.server);
      spinner.stop();

      if (opts.json) {
        json(containers);
        return;
      }

      heading("Contenedores");
      if (!containers?.length) {
        console.log("  No hay contenedores.");
        return;
      }
      table(
        ["ID", "Nombre", "Imagen", "Estado", "Puertos"],
        containers.map((c: any) => [
          (c.Id || c.containerId || "-").slice(0, 12),
          truncate((c.Names?.[0] || c.name || "-").replace(/^\//, ""), 30),
          truncate(c.Image || "-", 30),
          statusColor(c.State || c.status || "-"),
          truncate(
            (c.Ports || [])
              .map((p: any) => `${p.PublicPort || ""}:${p.PrivatePort || ""}`)
              .filter(Boolean)
              .join(", ") || "-",
            25
          ),
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
