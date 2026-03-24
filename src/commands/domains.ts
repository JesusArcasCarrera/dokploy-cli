import { Command } from "commander";
import { DokployClient } from "../lib/client.js";
import { table, heading, success, error, json, warn, info, statusColor } from "../lib/output.js";
import ora from "ora";

export const domainsCmd = new Command("domains")
  .description("Gestionar dominios");

domainsCmd
  .command("list")
  .alias("ls")
  .description("Listar dominios de una aplicación o compose")
  .option("-a, --app <appId>", "ID de la aplicación")
  .option("-c, --compose <composeId>", "ID del compose")
  .option("--json", "Salida en JSON")
  .action(async (opts) => {
    if (!opts.app && !opts.compose) {
      error("Especifica --app o --compose");
      return;
    }
    const spinner = ora("Cargando dominios...").start();
    try {
      const client = new DokployClient();
      let domains: any[];
      if (opts.app) {
        domains = await client.query<any[]>("domain.byApplicationId", { applicationId: opts.app });
      } else {
        domains = await client.query<any[]>("domain.byComposeId", { composeId: opts.compose });
      }
      spinner.stop();

      if (opts.json) {
        json(domains);
        return;
      }

      heading("Dominios");
      if (!domains?.length) {
        info("  No hay dominios configurados.");
        return;
      }
      table(
        ["ID", "Host", "Path", "Puerto", "HTTPS", "Cert", "Tipo"],
        domains.map((d: any) => [
          d.domainId?.slice(0, 8) ?? "-",
          d.host ?? "-",
          d.path || "/",
          String(d.port ?? 80),
          d.https ? "si" : "no",
          d.certificateType ?? "none",
          d.domainType ?? "-",
        ])
      );
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

domainsCmd
  .command("get <domainId>")
  .description("Ver detalle de un dominio")
  .option("--json", "Salida en JSON")
  .action(async (domainId, opts) => {
    try {
      const client = new DokployClient();
      const d = await client.query<any>("domain.one", { domainId });

      if (opts.json) {
        json(d);
        return;
      }

      heading(`Dominio: ${d.host}`);
      console.log(`  ID:             ${d.domainId}`);
      console.log(`  Host:           ${d.host}`);
      console.log(`  Path:           ${d.path || "/"}`);
      console.log(`  Puerto:         ${d.port ?? 80}`);
      console.log(`  HTTPS:          ${d.https ? "si" : "no"}`);
      console.log(`  Certificado:    ${d.certificateType ?? "none"}`);
      console.log(`  Tipo:           ${d.domainType ?? "-"}`);
      console.log(`  Servicio:       ${d.serviceName ?? "-"}`);
      console.log(`  Strip Path:     ${d.stripPath ? "si" : "no"}`);
      console.log(`  Internal Path:  ${d.internalPath ?? "-"}`);
    } catch (err: any) {
      error(err.message);
    }
  });

domainsCmd
  .command("add")
  .description("Añadir un dominio")
  .requiredOption("--host <host>", "Hostname (ej: app.ejemplo.com)")
  .option("-a, --app <appId>", "ID de la aplicación")
  .option("-c, --compose <composeId>", "ID del compose")
  .option("-p, --port <port>", "Puerto", "80")
  .option("--path <path>", "Path prefix (ej: /api)")
  .option("--https", "Habilitar HTTPS")
  .option("--cert <type>", "Tipo de certificado: letsencrypt, none, custom", "none")
  .option("--service <name>", "Nombre del servicio (para compose)")
  .option("--strip-path", "Eliminar path prefix antes de enviar al backend")
  .action(async (opts) => {
    if (!opts.app && !opts.compose) {
      error("Especifica --app o --compose");
      return;
    }
    const spinner = ora("Creando dominio...").start();
    try {
      const client = new DokployClient();
      await client.mutate("domain.create", {
        host: opts.host,
        applicationId: opts.app,
        composeId: opts.compose,
        port: Number(opts.port),
        path: opts.path,
        https: opts.https ?? false,
        certificateType: opts.cert,
        serviceName: opts.service,
        stripPath: opts.stripPath ?? false,
        domainType: opts.compose ? "compose" : "application",
      });
      spinner.stop();
      success(`Dominio ${opts.host} creado.`);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

domainsCmd
  .command("update <domainId>")
  .description("Actualizar un dominio existente")
  .option("--host <host>", "Nuevo hostname")
  .option("-p, --port <port>", "Nuevo puerto")
  .option("--path <path>", "Nuevo path prefix")
  .option("--https", "Habilitar HTTPS")
  .option("--no-https", "Deshabilitar HTTPS")
  .option("--cert <type>", "Tipo de certificado: letsencrypt, none, custom")
  .option("--service <name>", "Nombre del servicio")
  .option("--strip-path", "Eliminar path prefix")
  .option("--no-strip-path", "No eliminar path prefix")
  .action(async (domainId, opts) => {
    const spinner = ora("Actualizando dominio...").start();
    try {
      const client = new DokployClient();

      const data: Record<string, unknown> = { domainId };
      if (opts.host) data.host = opts.host;
      if (opts.port) data.port = Number(opts.port);
      if (opts.path !== undefined) data.path = opts.path;
      if (opts.https !== undefined) data.https = opts.https;
      if (opts.cert) data.certificateType = opts.cert;
      if (opts.service) data.serviceName = opts.service;
      if (opts.stripPath !== undefined) data.stripPath = opts.stripPath;

      await client.mutate("domain.update", data);
      spinner.stop();
      success("Dominio actualizado.");
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

domainsCmd
  .command("delete <domainId>")
  .description("Eliminar un dominio")
  .action(async (domainId) => {
    warn(`Eliminando dominio ${domainId}. El tráfico dejará de llegar a este host.`);
    const spinner = ora("Eliminando dominio...").start();
    try {
      const client = new DokployClient();
      await client.mutate("domain.delete", { domainId });
      spinner.stop();
      success("Dominio eliminado.");
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

domainsCmd
  .command("validate <domain>")
  .description("Validar resolución DNS de un dominio")
  .option("--ip <serverIp>", "IP esperada del servidor")
  .action(async (domain, opts) => {
    const spinner = ora(`Validando ${domain}...`).start();
    try {
      const client = new DokployClient();
      const result = await client.mutate<any>("domain.validateDomain", {
        domain,
        ...(opts.ip ? { serverIp: opts.ip } : {}),
      });
      spinner.stop();
      json(result);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });

domainsCmd
  .command("generate")
  .description("Generar dominio automático (traefik.me)")
  .requiredOption("--app-name <appName>", "Nombre de la aplicación")
  .option("-s, --server <serverId>", "ID del servidor")
  .action(async (opts) => {
    const spinner = ora("Generando dominio...").start();
    try {
      const client = new DokployClient();
      const result = await client.mutate<any>("domain.generateDomain", {
        appName: opts.appName,
        ...(opts.server ? { serverId: opts.server } : {}),
      });
      spinner.stop();
      success(`Dominio generado: ${result}`);
    } catch (err: any) {
      spinner.stop();
      error(err.message);
    }
  });
