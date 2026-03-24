import { Command } from "commander";
import { saveProfile, setActiveProfile, listProfiles, getProfile } from "../lib/client.js";
import { success, error, table, heading, info } from "../lib/output.js";

export const authCmd = new Command("auth")
  .description("Gestionar autenticación con instancias de Dokploy");

authCmd
  .command("login")
  .description("Configurar conexión a una instancia de Dokploy")
  .requiredOption("-u, --url <url>", "URL de la instancia (ej: https://panel.ejemplo.com)")
  .requiredOption("-k, --api-key <key>", "API Key generada en Settings > API Keys")
  .option("-p, --profile <name>", "Nombre del perfil", "default")
  .action(async (opts) => {
    try {
      const url = opts.url.replace(/\/$/, "");
      saveProfile(opts.profile, { url, apiKey: opts.apiKey });
      setActiveProfile(opts.profile);

      // Verificar conexión vía tRPC nativo (project.all es universal y ligero)
      const res = await fetch(`${url}/api/trpc/project.all`, {
        headers: { "x-api-key": opts.apiKey },
      });

      if (res.ok) {
        success(`Conectado a ${url} (perfil: ${opts.profile})`);
      } else if (res.status === 401) {
        error("API Key inválida o sin permisos.");
        info("Genera una API Key en el dashboard: Settings > API Keys.");
      } else {
        error(`Verificación falló (HTTP ${res.status})`);
        info("Verifica la URL y la API key.");
      }
    } catch (err: any) {
      error(`No se pudo conectar: ${err.message}`);
      info("Las credenciales se guardaron igualmente. Verifica que la URL sea correcta.");
    }
  });

authCmd
  .command("list")
  .description("Listar perfiles configurados")
  .action(() => {
    const profiles = listProfiles();
    if (profiles.length === 0) {
      info('No hay perfiles. Usa "dokploy auth login" para configurar uno.');
      return;
    }
    heading("Perfiles");
    table(
      ["Nombre", "URL"],
      profiles.map((name) => {
        try {
          const p = getProfile(name);
          return [name, p.url];
        } catch {
          return [name, "(error)"];
        }
      })
    );
  });

authCmd
  .command("use <profile>")
  .description("Cambiar perfil activo")
  .action((profile) => {
    try {
      getProfile(profile); // Verificar que existe
      setActiveProfile(profile);
      success(`Perfil activo: ${profile}`);
    } catch (err: any) {
      error(err.message);
    }
  });
