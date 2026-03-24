import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, success, error, json, truncate, timeAgo } from "../lib/output.js";
import ora from "ora";

export const projectsCmd = new Command("projects")
  .alias("p")
  .description("Gestionar proyectos");

projectsCmd
  .command("list")
  .alias("ls")
  .description("Listar todos los proyectos")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    const spinner = ora("Cargando proyectos...").start();
    try {
      const client = new DokployClient();
      const projects = await client.listProjects();
      spinner.stop();

      if (opts.json) {
        json(projects);
        return;
      }

      heading("Proyectos");
      if (!projects?.length) {
        console.log("  No hay proyectos.");
        return;
      }
      table(
        ["ID", "Nombre", "Descripción", "Apps", "Compose", "DBs", "Creado"],
        projects.map((p: any) => {
          const envs = p.environments ?? [];
          const apps = envs.reduce((s: number, e: any) => s + (e.applications?.length ?? 0), 0);
          const compose = envs.reduce((s: number, e: any) => s + (e.compose?.length ?? 0), 0);
          const dbs = envs.reduce((s: number, e: any) =>
            s + (e.postgres?.length ?? 0) + (e.mysql?.length ?? 0) +
            (e.mongo?.length ?? 0) + (e.redis?.length ?? 0) + (e.mariadb?.length ?? 0), 0);
          return [
            p.projectId?.slice(0, 8) ?? "-",
            p.name ?? "-",
            truncate(p.description ?? "", 30),
            String(apps),
            String(compose),
            String(dbs),
            timeAgo(p.createdAt),
          ];
        })
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

projectsCmd
  .command("get <projectId>")
  .description("Ver detalle de un proyecto")
  .option("--json", "Salida en JSON")
  .action(async (projectId, opts) => {
    try {
      const client = new DokployClient();
      const project = await client.getProject(projectId);

      if (opts.json) {
        json(project);
        return;
      }

      heading(`Proyecto: ${project.name}`);
      console.log(`  ID:          ${project.projectId}`);
      console.log(`  Descripción: ${project.description || "-"}`);
      console.log(`  Creado:      ${project.createdAt}`);

      if (project.applications?.length) {
        heading("  Aplicaciones:");
        table(
          ["ID", "Nombre", "Estado", "Tipo Build"],
          project.applications.map((a: any) => [
            a.applicationId?.slice(0, 8),
            a.name,
            a.applicationStatus ?? "-",
            a.buildType ?? "-",
          ])
        );
      }

      if (project.compose?.length) {
        heading("  Compose:");
        table(
          ["ID", "Nombre", "Estado"],
          project.compose.map((c: any) => [
            c.composeId?.slice(0, 8),
            c.name,
            c.composeStatus ?? "-",
          ])
        );
      }
    } catch (err: any) {
      error(err.message);
    }
  });

projectsCmd
  .command("create <name>")
  .description("Crear un nuevo proyecto")
  .option("-d, --description <desc>", "Descripción")
  .action(async (name, opts) => {
    const spinner = ora("Creando proyecto...").start();
    try {
      const client = new DokployClient();
      const result = await client.createProject(name, opts.description);
      spinner.stop();
      success(`Proyecto "${name}" creado.`);
      json(result);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

projectsCmd
  .command("delete <projectId>")
  .description("Eliminar un proyecto")
  .action(async (projectId) => {
    const spinner = ora("Eliminando proyecto...").start();
    try {
      const client = new DokployClient();
      await client.deleteProject(projectId);
      spinner.stop();
      success("Proyecto eliminado.");
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
