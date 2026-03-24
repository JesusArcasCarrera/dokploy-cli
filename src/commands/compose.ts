import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, success, error, json, statusColor, timeAgo } from "../lib/output.js";
import ora from "ora";

export const composeCmd = new Command("compose")
  .alias("c")
  .description("Gestionar servicios Compose");

composeCmd
  .command("list")
  .alias("ls")
  .description("Listar servicios compose")
  .option("-p, --project <projectId>", "Filtrar por proyecto")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando compose...").start();
    try {
      const client = new DokployClient();
      const composes = await client.listComposes(opts.project);
      spinner.stop();

      if (opts.json) {
        json(composes);
        return;
      }

      heading("Compose Services");
      if (!composes?.length) {
        console.log("  No hay servicios compose.");
        return;
      }
      table(
        ["ID", "Nombre", "Estado", "Actualizado"],
        composes.map((c: any) => [
          c.composeId?.slice(0, 8) ?? "-",
          c.name ?? "-",
          statusColor(c.composeStatus ?? "-"),
          timeAgo(c.updatedAt),
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

composeCmd
  .command("get <composeId>")
  .description("Ver detalle de un compose")
  .option("--json", "Salida en JSON")
  .action(async (composeId, opts) => {
    try {
      const client = new DokployClient();
      const comp = await client.getCompose(composeId);

      if (opts.json) {
        json(comp);
        return;
      }

      heading(`Compose: ${comp.name}`);
      console.log(`  ID:          ${comp.composeId}`);
      console.log(`  Estado:      ${statusColor(comp.composeStatus)}`);
      console.log(`  Tipo:        ${comp.composeType ?? "-"}`);
      console.log(`  Repo:        ${comp.repository || comp.customGitUrl || "-"}`);
      console.log(`  Branch:      ${comp.branch || "-"}`);
      console.log(`  Creado:      ${comp.createdAt}`);
    } catch (err: any) {
      error(err.message);
    }
  });

composeCmd
  .command("deploy <composeId>")
  .description("Desplegar un compose")
  .action(async (composeId) => {
    const spinner = ora("Desplegando compose...").start();
    try {
      const client = new DokployClient();
      await client.deployCompose(composeId);
      spinner.stop();
      success(`Despliegue compose iniciado para ${composeId}`);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

composeCmd
  .command("redeploy <composeId>")
  .description("Re-desplegar compose")
  .action(async (composeId) => {
    const spinner = ora("Re-desplegando compose...").start();
    try {
      const client = new DokployClient();
      await client.redeployCompose(composeId);
      spinner.stop();
      success(`Re-despliegue compose iniciado para ${composeId}`);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
