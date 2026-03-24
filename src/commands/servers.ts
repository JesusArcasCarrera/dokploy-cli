import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, error, json, statusColor, truncate } from "../lib/output.js";
import ora from "ora";

export const serversCmd = new Command("servers")
  .alias("s")
  .description("Gestionar servidores");

serversCmd
  .command("list")
  .alias("ls")
  .description("Listar servidores")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando servidores...").start();
    try {
      const client = new DokployClient();
      const servers = await client.listServers();
      spinner.stop();

      if (opts.json) {
        json(servers);
        return;
      }

      heading("Servidores");
      if (!servers?.length) {
        console.log("  No hay servidores.");
        return;
      }
      table(
        ["ID", "Nombre", "IP", "Estado", "Descripción"],
        servers.map((s: any) => [
          s.serverId?.slice(0, 8) ?? "-",
          s.name ?? "-",
          s.ipAddress ?? "-",
          statusColor(s.serverStatus ?? "-"),
          truncate(s.description ?? "", 30),
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

serversCmd
  .command("get <serverId>")
  .description("Ver detalle de un servidor")
  .option("--json", "Salida en JSON")
  .action(async (serverId, opts) => {
    try {
      const client = new DokployClient();
      const srv = await client.getServer(serverId);

      if (opts.json) {
        json(srv);
        return;
      }

      heading(`Servidor: ${srv.name}`);
      console.log(`  ID:          ${srv.serverId}`);
      console.log(`  IP:          ${srv.ipAddress ?? "-"}`);
      console.log(`  Estado:      ${statusColor(srv.serverStatus)}`);
      console.log(`  Descripción: ${srv.description || "-"}`);
      console.log(`  SSH Port:    ${srv.sshPort ?? 22}`);
      console.log(`  Docker:      ${srv.dockerPath ?? "-"}`);
    } catch (err: any) {
      error(err.message);
    }
  });
