import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, success, error, json, statusColor, timeAgo } from "../lib/output.js";
import ora from "ora";

export const appsCmd = new Command("apps")
  .alias("a")
  .description("Gestionar aplicaciones");

appsCmd
  .command("list")
  .alias("ls")
  .description("Listar aplicaciones")
  .option("-p, --project <projectId>", "Filtrar por proyecto")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando aplicaciones...").start();
    try {
      const client = new DokployClient();
      const apps = await client.listApplications(opts.project);
      spinner.stop();

      if (opts.json) {
        json(apps);
        return;
      }

      heading("Aplicaciones");
      if (!apps?.length) {
        console.log("  No hay aplicaciones.");
        return;
      }
      table(
        ["ID", "Nombre", "Estado", "Build", "Imagen", "Actualizado"],
        apps.map((a: any) => [
          a.applicationId?.slice(0, 8) ?? "-",
          a.name ?? "-",
          statusColor(a.applicationStatus ?? "-"),
          a.buildType ?? "-",
          a.dockerImage || a.sourceType || "-",
          timeAgo(a.updatedAt),
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

appsCmd
  .command("get <appId>")
  .description("Ver detalle de una aplicación")
  .option("--json", "Salida en JSON")
  .action(async (appId, opts) => {
    try {
      const client = new DokployClient();
      const app = await client.getApplication(appId);

      if (opts.json) {
        json(app);
        return;
      }

      heading(`App: ${app.name}`);
      console.log(`  ID:        ${app.applicationId}`);
      console.log(`  Estado:    ${statusColor(app.applicationStatus)}`);
      console.log(`  Build:     ${app.buildType ?? "-"}`);
      console.log(`  Imagen:    ${app.dockerImage || "-"}`);
      console.log(`  Repo:      ${app.repository || app.customGitUrl || "-"}`);
      console.log(`  Branch:    ${app.branch || "-"}`);
      console.log(`  Creado:    ${app.createdAt}`);
    } catch (err: any) {
      error(err.message);
    }
  });

appsCmd
  .command("deploy <appId>")
  .description("Desplegar una aplicación")
  .action(async (appId) => {
    const spinner = ora("Iniciando despliegue...").start();
    try {
      const client = new DokployClient();
      await client.deployApplication(appId);
      spinner.stop();
      success(`Despliegue iniciado para ${appId}`);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

appsCmd
  .command("redeploy <appId>")
  .description("Re-desplegar (rebuild sin fetch)")
  .action(async (appId) => {
    const spinner = ora("Iniciando re-despliegue...").start();
    try {
      const client = new DokployClient();
      await client.redeployApplication(appId);
      spinner.stop();
      success(`Re-despliegue iniciado para ${appId}`);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

appsCmd
  .command("create")
  .description("Crear una nueva aplicación")
  .requiredOption("-n, --name <name>", "Nombre de la aplicación")
  .requiredOption("--app-name <appName>", "Nombre único (slug)")
  .requiredOption("-e, --env <environmentId>", "ID del environment")
  .option("-b, --build <type>", "Tipo de build (dockerfile, nixpacks, etc.)")
  .option("-s, --server <serverId>", "ID del servidor")
  .action(async (opts) => {
    const spinner = ora("Creando aplicación...").start();
    try {
      const client = new DokployClient();
      const result = await client.createApplication({
        name: opts.name,
        appName: opts.appName,
        environmentId: opts.env,
        buildType: opts.build,
        serverId: opts.server,
      });
      spinner.stop();
      success(`Aplicación "${opts.name}" creada.`);
      json(result);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
