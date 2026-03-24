import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, error, json, statusColor, timeAgo } from "../lib/output.js";
import ora from "ora";

export const deploymentsCmd = new Command("deployments")
  .alias("d")
  .description("Ver historial y cola de despliegues");

deploymentsCmd
  .command("list")
  .alias("ls")
  .description("Listar despliegues de una aplicación o compose")
  .option("-a, --app <appId>", "ID de la aplicación")
  .option("-c, --compose <composeId>", "ID del compose")
  .option("--all", "Vista centralizada de todos los despliegues")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando despliegues...").start();
    try {
      const client = new DokployClient();
      let deployments: any[];

      if (opts.all) {
        deployments = await client.listDeploymentsCentralized();
      } else if (opts.app) {
        deployments = await client.listDeployments(opts.app);
      } else if (opts.compose) {
        deployments = await client.listDeploymentsByCompose(opts.compose);
      } else {
        spinner.stop();
        error("Especifica --app, --compose, o --all");
        return;
      }

      spinner.stop();

      if (opts.json) {
        json(deployments);
        return;
      }

      heading("Despliegues");
      if (!deployments?.length) {
        console.log("  No hay despliegues.");
        return;
      }
      table(
        ["ID", "Estado", "Título", "Descripción", "Fecha"],
        deployments.slice(0, 20).map((d: any) => [
          d.deploymentId?.slice(0, 8) ?? "-",
          statusColor(d.status ?? "-"),
          d.title || d.titleLog || "-",
          d.description || d.descriptionLog || "-",
          timeAgo(d.createdAt),
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

deploymentsCmd
  .command("queue")
  .description("Ver cola de despliegues pendientes")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando cola...").start();
    try {
      const client = new DokployClient();
      const queue = await client.getDeploymentQueue();
      spinner.stop();

      if (opts.json) {
        json(queue);
        return;
      }

      heading("Cola de Despliegues");
      if (!queue?.length) {
        console.log("  Cola vacía.");
        return;
      }
      table(
        ["ID", "Estado", "Nombre", "Tipo", "Timestamp"],
        queue.map((j: any) => [
          String(j.id ?? "-").slice(0, 8),
          statusColor(j.state ?? "-"),
          j.name || "-",
          (j.data as any)?.applicationType || "-",
          j.timestamp ? timeAgo(new Date(j.timestamp)) : "-",
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
