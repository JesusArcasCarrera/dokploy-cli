import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { heading, success, error, warn, info, json } from "../lib/output.js";
import ora from "ora";

export const envCmd = new Command("env")
  .alias("e")
  .description("Gestionar variables de entorno");

/**
 * Enmascara valores sensibles en un string de env vars.
 * Detecta patrones comunes: PASSWORD, SECRET, TOKEN, KEY, etc.
 */
function maskEnvString(envStr: string, reveal: boolean): string {
  if (reveal || !envStr) return envStr;

  const sensitivePatterns =
    /^(.*(?:PASSWORD|SECRET|TOKEN|KEY|PRIVATE|CREDENTIAL|AUTH|API_KEY|DB_PASS|MASTER_KEY)[^=]*)=(.+)$/gim;

  return envStr.replace(sensitivePatterns, (_match, name, _value) => {
    return `${name}=********`;
  });
}

envCmd
  .command("get <environmentId>")
  .description("Ver variables de entorno de un environment")
  .option("--reveal", "Mostrar valores sensibles sin enmascarar")
  .option("--json", "Salida en JSON")
  .action(async (environmentId, opts) => {
    const spinner = ora("Cargando variables de entorno...").start();
    try {
      const client = new DokployClient();
      const env = await client.query<any>("environment.one", { environmentId });
      spinner.stop();

      if (opts.json) {
        if (!opts.reveal) {
          env.env = maskEnvString(env.env ?? "", false);
        }
        json(env);
        return;
      }

      heading(`Environment: ${env.name ?? environmentId}`);
      if (env.description) {
        info(`  ${env.description}`);
      }

      const envStr = env.env ?? "";
      if (!envStr.trim()) {
        info("  (sin variables definidas)");
        return;
      }

      if (!opts.reveal) {
        warn("Valores sensibles enmascarados. Usa --reveal para verlos.");
      }

      console.log();
      console.log(maskEnvString(envStr, opts.reveal ?? false));
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

envCmd
  .command("set <environmentId>")
  .description("Establecer variables de entorno (reemplaza todas)")
  .requiredOption("-v, --vars <vars>", 'Variables en formato KEY=VALUE separadas por "\\n" o ";"')
  .action(async (environmentId, opts) => {
    const spinner = ora("Actualizando variables de entorno...").start();
    try {
      const client = new DokployClient();

      // Normalizar separadores
      const envStr = opts.vars.replace(/;/g, "\n");

      await client.mutate("environment.update", {
        environmentId,
        env: envStr,
      });
      spinner.stop();
      success("Variables de entorno actualizadas.");
      warn("Recuerda: los cambios NO disparan un redespliegue automático.");
      info('Usa "dokploy apps deploy <appId>" para aplicar los cambios.');
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

envCmd
  .command("append <environmentId>")
  .description("Añadir variables sin reemplazar las existentes")
  .requiredOption("-v, --vars <vars>", 'Variables a añadir: KEY=VALUE separadas por "\\n" o ";"')
  .action(async (environmentId, opts) => {
    const spinner = ora("Cargando variables actuales...").start();
    try {
      const client = new DokployClient();
      const current = await client.query<any>("environment.one", { environmentId });
      const currentEnv = (current.env ?? "").trim();

      const newVars = opts.vars.replace(/;/g, "\n").trim();

      // Parsear variables nuevas para detectar duplicados
      const newKeys = new Set(
        newVars
          .split("\n")
          .filter((l: string) => l.includes("="))
          .map((l: string) => l.split("=")[0]!.trim())
      );

      const existingKeys = currentEnv
        .split("\n")
        .filter((l: string) => l.includes("="))
        .map((l: string) => l.split("=")[0]!.trim());

      const conflicts = existingKeys.filter((k: string) => newKeys.has(k));
      if (conflicts.length > 0) {
        spinner.stop();
        warn(`Las siguientes variables se sobrescribirán: ${conflicts.join(", ")}`);
      }

      // Merge: eliminar keys existentes que se van a sobrescribir, luego append
      const filteredExisting = currentEnv
        .split("\n")
        .filter((l: string) => {
          const key = l.split("=")[0]?.trim();
          return !newKeys.has(key!);
        })
        .join("\n");

      const merged = [filteredExisting, newVars].filter(Boolean).join("\n");

      await client.mutate("environment.update", {
        environmentId,
        env: merged,
      });
      spinner.stop();
      success("Variables añadidas.");
      warn("Recuerda: los cambios NO disparan un redespliegue automático.");
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

envCmd
  .command("remove <environmentId>")
  .description("Eliminar una o más variables por nombre")
  .requiredOption("-k, --keys <keys>", "Nombres de variables a eliminar, separados por coma")
  .action(async (environmentId, opts) => {
    const spinner = ora("Eliminando variables...").start();
    try {
      const client = new DokployClient();
      const current = await client.query<any>("environment.one", { environmentId });
      const currentEnv = (current.env ?? "").trim();

      const keysToRemove = new Set(opts.keys.split(",").map((k: string) => k.trim()));

      const filtered = currentEnv
        .split("\n")
        .filter((l: string) => {
          const key = l.split("=")[0]?.trim();
          return !keysToRemove.has(key!);
        })
        .join("\n");

      await client.mutate("environment.update", {
        environmentId,
        env: filtered,
      });
      spinner.stop();
      success(`Variables eliminadas: ${[...keysToRemove].join(", ")}`);
      warn("Recuerda: los cambios NO disparan un redespliegue automático.");
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

envCmd
  .command("list <projectId>")
  .alias("ls")
  .description("Listar environments de un proyecto")
  .option("--json", "Salida en JSON")
  .action(async (projectId, opts) => {
    const spinner = ora("Cargando environments...").start();
    try {
      const client = new DokployClient();
      const envs = await client.query<any[]>("environment.byProjectId", { projectId });
      spinner.stop();

      if (opts.json) {
        json(envs);
        return;
      }

      heading("Environments");
      if (!envs?.length) {
        info("  No hay environments.");
        return;
      }
      for (const e of envs) {
        const varCount = (e.env ?? "")
          .split("\n")
          .filter((l: string) => l.trim() && l.includes("=")).length;
        console.log(`  ${e.environmentId?.slice(0, 8)}  ${e.name ?? "-"}  (${varCount} vars)`);
      }
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
