import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { heading, error, info, statusColor, table, json as jsonOut } from "../lib/output.js";
import chalk from "chalk";
import ora from "ora";

export const statusCmd = new Command("status")
  .description("Vista general de la instancia, o detalle de un proyecto")
  .argument("[project]", "ID o nombre del proyecto para vista detallada")
  .option("--json", "Salida en JSON")
  .action(async (project, opts) => {
    if (project) {
      await projectDetail(project, opts);
    } else {
      await overview(opts);
    }
  });

// ── Vista general ──

async function overview(opts: { json?: boolean }) {
  const spinner = ora("Conectando...").start();
  try {
    const client = new DokployClient();
    const [projects, containers] = await Promise.all([
      client.listProjects().catch(() => []),
      client.getContainers().catch(() => []),
    ]);
    spinner.stop();

    const services = flattenServices(projects);

    if (opts.json) {
      jsonOut({ projects: projects.length, services, containers: containers.length });
      return;
    }

    const running = containers.filter((c: any) => c.state === "running").length;
    const stopped = containers.length - running;
    const errored = services.filter((s) => s.status === "error");

    console.log();
    console.log(chalk.bold("  Dokploy"));
    console.log(chalk.dim("  ───────────────────────────"));
    console.log(`  Proyectos      ${projects.length}`);
    console.log(`  Contenedores   ${chalk.green(running)}  ${stopped > 0 ? chalk.dim("/ " + stopped + " stopped") : ""}`);
    if (errored.length > 0) {
      console.log(`  Errores        ${chalk.red.bold(errored.length)}`);
    }
    console.log();

    // Una fila por servicio, agrupado por proyecto
    const rows: string[][] = [];
    for (const p of projects) {
      const pServices = services.filter((s) => s.project === p.name);
      if (pServices.length === 0) {
        rows.push([chalk.bold(p.name), chalk.dim("(vacío)"), "", ""]);
        continue;
      }
      let first = true;
      for (const s of pServices) {
        rows.push([
          first ? chalk.bold(p.name) : "",
          s.name,
          statusColor(s.status),
          s.env !== "production" ? chalk.dim(s.env) : "",
        ]);
        first = false;
      }
    }

    table(["Proyecto", "Servicio", "Estado", "Env"], rows);

    if (errored.length > 0) {
      console.log();
      info(`  ${chalk.red("!")} ${errored.map((e) => e.name).join(", ")}`);
    }

    console.log();
    info('  dokploy status <proyecto> para detalle');
  } catch (err: any) {
    spinner.stop();
    error(err.message);
  }
}

// ── Detalle de proyecto ──

async function projectDetail(nameOrId: string, opts: { json?: boolean }) {
  const spinner = ora("Cargando...").start();
  try {
    const client = new DokployClient();
    const projects = await client.listProjects();

    const project = projects.find(
      (p: any) =>
        p.projectId === nameOrId ||
        p.projectId?.startsWith(nameOrId) ||
        p.name.toLowerCase() === nameOrId.toLowerCase()
    );

    if (!project) {
      spinner.stop();
      error(`Proyecto "${nameOrId}" no encontrado.`);
      return;
    }

    const containers = await client.getContainers().catch(() => []);
    spinner.stop();

    if (opts.json) {
      jsonOut(project);
      return;
    }

    const desc = project.description ? chalk.dim(` — ${project.description}`) : "";
    console.log();
    console.log(`  ${chalk.bold(project.name)}${desc}`);
    console.log(`  ${chalk.dim("ID: " + project.projectId)}`);
    console.log();

    for (const env of project.environments ?? []) {
      const envLabel = env.isDefault ? env.name : chalk.yellow(env.name);
      const apps = env.applications ?? [];
      const composes = env.compose ?? [];
      const dbs = ["postgres", "mysql", "mongo", "redis", "mariadb"].flatMap(
        (t) => (env[t] ?? []).map((db: any) => ({ type: t, ...db }))
      );

      const total = apps.length + composes.length + dbs.length;
      if (total === 0 && (project.environments?.length ?? 0) <= 1) continue;
      if (total === 0) {
        console.log(`  ${chalk.dim(`[${envLabel}] (vacío)`)}`);
        continue;
      }

      if ((project.environments?.length ?? 0) > 1) {
        console.log(`  ${chalk.dim("[")}${envLabel}${chalk.dim("]")}`);
      }

      const rows: string[][] = [];

      for (const a of apps) {
        const ctr = matchContainer(containers, a.appName ?? a.name);
        rows.push([
          chalk.cyan("app"),
          a.name,
          statusColor(a.applicationStatus ?? "-"),
          a.buildType ?? "-",
          ctr?.status ?? chalk.dim("-"),
        ]);
      }
      for (const c of composes) {
        const ctr = matchContainer(containers, c.appName ?? c.name);
        rows.push([
          chalk.magenta("compose"),
          c.name,
          statusColor(c.composeStatus ?? "-"),
          "",
          ctr?.status ?? chalk.dim("-"),
        ]);
      }
      for (const db of dbs) {
        rows.push([
          chalk.yellow(db.type),
          db.name ?? db.appName ?? "-",
          chalk.dim("-"),
          "",
          chalk.dim("-"),
        ]);
      }

      table(["Tipo", "Nombre", "Estado", "Build", "Container"], rows);
      console.log();
    }
  } catch (err: any) {
    spinner.stop();
    error(err.message);
  }
}

// ── Helpers ──

interface FlatService {
  project: string;
  env: string;
  type: string;
  name: string;
  status: string;
}

function flattenServices(projects: any[]): FlatService[] {
  const out: FlatService[] = [];
  for (const p of projects) {
    for (const env of p.environments ?? []) {
      for (const a of env.applications ?? []) {
        out.push({ project: p.name, env: env.name, type: "app", name: a.name, status: a.applicationStatus ?? "-" });
      }
      for (const c of env.compose ?? []) {
        out.push({ project: p.name, env: env.name, type: "compose", name: c.name, status: c.composeStatus ?? "-" });
      }
    }
  }
  return out;
}

function matchContainer(containers: any[], name: string): any | undefined {
  const lower = name.toLowerCase().replace(/\s+/g, "-");
  return containers.find((c: any) => (c.name ?? "").toLowerCase().includes(lower));
}
