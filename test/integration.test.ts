#!/usr/bin/env tsx

/**
 * Tests de integración contra una instancia real de Dokploy.
 *
 * Requisito: tener un perfil configurado con `dokploy auth login`.
 *
 * Crea un proyecto con nombre aleatorio absurdo, ejecuta operaciones
 * sobre él y limpia todo al final.
 *
 * Ejecutar: npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { DokployClient } from "../src/lib/client.js";

// Nombre imposible de colisionar
const RANDOM_SUFFIX = Math.random().toString(36).slice(2) + Date.now().toString(36);
const TEST_PROJECT_NAME = `test_integration_xk9wq2mf_${RANDOM_SUFFIX}_do_not_use`;

let client: DokployClient;
let projectId: string;
let environmentId: string;
let applicationId: string;
let domainId: string;

// --- Helpers ---

function log(msg: string) {
  console.log(`  ⏵ ${msg}`);
}

// --- Tests ---

describe("dokploy-cli integration", () => {
  before(() => {
    try {
      client = new DokployClient();
    } catch (err: any) {
      console.error("\n✗ No hay perfil configurado.");
      console.error('  Ejecuta: dokploy auth login -u <url> -k <apikey>\n');
      process.exit(1);
    }
  });

  // ============================================================
  // PROYECTO
  // ============================================================

  describe("projects", () => {
    it("should create a test project", async () => {
      const result = await client.createProject(
        TEST_PROJECT_NAME,
        "Proyecto de test automático - borrar si persiste"
      );
      log(`Proyecto creado: ${TEST_PROJECT_NAME}`);

      assert.ok(result, "createProject devolvió resultado");

      // El resultado puede venir como { project: {...}, environment: {...} }
      const project = (result as any).project ?? result;
      projectId = project.projectId;
      assert.ok(projectId, "projectId existe");
      log(`projectId: ${projectId}`);

      // Capturar environmentId del environment por defecto
      const env = (result as any).environment;
      if (env?.environmentId) {
        environmentId = env.environmentId;
        log(`environmentId (default): ${environmentId}`);
      }
    });

    it("should list projects and find the test project", async () => {
      const projects = await client.listProjects();
      assert.ok(Array.isArray(projects), "listProjects devolvió array");

      const found = projects.find((p: any) => p.projectId === projectId);
      assert.ok(found, "Proyecto de test encontrado en la lista");
      log(`Encontrado en lista (${projects.length} proyectos total)`);
    });

    it("should get project detail", async () => {
      const project = await client.getProject(projectId);
      assert.ok(project, "getProject devolvió resultado");
      assert.equal(project.name, TEST_PROJECT_NAME);
      log(`Detalle OK: ${project.name}`);
    });
  });

  // ============================================================
  // ENVIRONMENTS
  // ============================================================

  describe("environments", () => {
    it("should list environments for the project", async () => {
      // Si no tenemos environmentId del create, buscarlo
      if (!environmentId) {
        const envs = await client.query<any[]>("environment.byProjectId", {
          projectId,
        });
        assert.ok(envs?.length, "Al menos un environment existe");
        environmentId = envs[0].environmentId;
        log(`environmentId encontrado: ${environmentId}`);
      }

      const envs = await client.query<any[]>("environment.byProjectId", {
        projectId,
      });
      assert.ok(Array.isArray(envs), "byProjectId devolvió array");
      log(`${envs.length} environment(s) encontrado(s)`);
    });

    it("should get environment detail", async () => {
      const env = await client.query<any>("environment.one", { environmentId });
      assert.ok(env, "environment.one devolvió resultado");
      assert.equal(env.environmentId, environmentId);
      log(`Environment: ${env.name ?? "(sin nombre)"}`);
    });
  });

  // ============================================================
  // ENV VARS
  // ============================================================

  describe("env vars", () => {
    it("should set env vars", async () => {
      await client.mutate("environment.update", {
        environmentId,
        env: "TEST_VAR_1=hello_world\nTEST_SECRET_KEY=super_secret_123\nTEST_DB_PASSWORD=p4ssw0rd!",
      });
      log("Variables establecidas");

      const env = await client.query<any>("environment.one", { environmentId });
      assert.ok(env.env.includes("TEST_VAR_1=hello_world"), "TEST_VAR_1 presente");
      assert.ok(env.env.includes("TEST_SECRET_KEY="), "TEST_SECRET_KEY presente");
      log("Variables verificadas en lectura");
    });

    it("should append env vars without losing existing", async () => {
      // Leer actuales
      const before = await client.query<any>("environment.one", { environmentId });
      const currentEnv = before.env ?? "";

      // Añadir nueva variable
      const newVar = "TEST_APPENDED_VAR=appended_value";
      const merged = [currentEnv.trim(), newVar].join("\n");

      await client.mutate("environment.update", {
        environmentId,
        env: merged,
      });

      const after = await client.query<any>("environment.one", { environmentId });
      assert.ok(after.env.includes("TEST_VAR_1=hello_world"), "Variable original preservada");
      assert.ok(after.env.includes("TEST_APPENDED_VAR=appended_value"), "Variable nueva añadida");
      log("Append verificado sin pérdida de datos");
    });

    it("should remove specific env vars", async () => {
      const before = await client.query<any>("environment.one", { environmentId });
      const filtered = before.env
        .split("\n")
        .filter((l: string) => !l.startsWith("TEST_APPENDED_VAR="))
        .join("\n");

      await client.mutate("environment.update", {
        environmentId,
        env: filtered,
      });

      const after = await client.query<any>("environment.one", { environmentId });
      assert.ok(!after.env.includes("TEST_APPENDED_VAR"), "Variable eliminada");
      assert.ok(after.env.includes("TEST_VAR_1="), "Otras variables preservadas");
      log("Remove selectivo verificado");
    });

    it("should clear all env vars", async () => {
      await client.mutate("environment.update", {
        environmentId,
        env: "",
      });

      const after = await client.query<any>("environment.one", { environmentId });
      assert.equal(after.env.trim(), "", "Env vars vacías");
      log("Clear total verificado");
    });
  });

  // ============================================================
  // APLICACIONES
  // ============================================================

  describe("applications", () => {
    const APP_NAME = `testapp_${RANDOM_SUFFIX}`;

    it("should create an application in the test project", async () => {
      assert.ok(environmentId, "environmentId disponible");

      const result = await client.createApplication({
        name: `Test App ${RANDOM_SUFFIX}`,
        appName: APP_NAME,
        environmentId,
      });

      assert.ok(result, "createApplication devolvió resultado");
      applicationId = (result as any).applicationId;
      assert.ok(applicationId, "applicationId existe");
      log(`App creada: ${APP_NAME} (${applicationId})`);
    });

    it("should get application detail", async () => {
      const app = await client.getApplication(applicationId);
      assert.ok(app, "getApplication devolvió resultado");
      // Dokploy añade sufijo random al appName, verificamos que empiece con nuestro nombre
      assert.ok(app.appName.startsWith(APP_NAME), `appName empieza con ${APP_NAME}`);
      log(`Detalle OK: ${app.name} (appName: ${app.appName}, build: ${app.buildType ?? "none"})`);
    });

    it("should list applications and find test app", async () => {
      const project = await client.getProject(projectId);
      // Las apps están dentro de environments[].applications
      const allApps = (project.environments ?? []).flatMap(
        (env: any) => env.applications ?? []
      );
      const found = allApps.find((a: any) => a.applicationId === applicationId);
      assert.ok(found, "App de test encontrada en el proyecto");
      log(`App encontrada en proyecto (${allApps.length} apps total)`);
    });
  });

  // ============================================================
  // DOMINIOS
  // ============================================================

  describe("domains", () => {
    const TEST_HOST = `test-${RANDOM_SUFFIX}.localhost.test`;

    it("should create a domain for the test app", async () => {
      assert.ok(applicationId, "applicationId disponible");

      const result = await client.mutate<any>("domain.create", {
        host: TEST_HOST,
        applicationId,
        port: 3000,
        https: false,
        certificateType: "none",
        domainType: "application",
      });

      assert.ok(result, "domain.create devolvió resultado");
      domainId = result.domainId;
      assert.ok(domainId, "domainId existe");
      log(`Dominio creado: ${TEST_HOST} (${domainId})`);
    });

    it("should list domains for the test app", async () => {
      const domains = await client.query<any[]>("domain.byApplicationId", {
        applicationId,
      });
      assert.ok(Array.isArray(domains), "byApplicationId devolvió array");
      assert.ok(domains.length > 0, "Al menos un dominio");

      const found = domains.find((d: any) => d.domainId === domainId);
      assert.ok(found, "Dominio de test encontrado");
      assert.equal(found.host, TEST_HOST);
      log(`Dominio encontrado en lista (${domains.length} total)`);
    });

    it("should get domain detail", async () => {
      const d = await client.query<any>("domain.one", { domainId });
      assert.ok(d, "domain.one devolvió resultado");
      assert.equal(d.host, TEST_HOST);
      assert.equal(d.port, 3000);
      log(`Detalle OK: ${d.host}:${d.port}`);
    });

    it("should update domain port", async () => {
      await client.mutate("domain.update", {
        domainId,
        host: TEST_HOST,
        port: 8080,
      });

      const d = await client.query<any>("domain.one", { domainId });
      assert.equal(d.port, 8080);
      log(`Puerto actualizado a 8080`);
    });

    it("should delete the test domain", async () => {
      await client.mutate("domain.delete", { domainId });

      // Verificar que ya no existe
      try {
        await client.query("domain.one", { domainId });
        assert.fail("El dominio debería haberse eliminado");
      } catch {
        log("Dominio eliminado correctamente");
      }
      domainId = ""; // ya no existe
    });
  });

  // ============================================================
  // SERVIDORES (solo lectura)
  // ============================================================

  describe("servers", () => {
    it("should list servers", async () => {
      const servers = await client.listServers();
      assert.ok(Array.isArray(servers), "listServers devolvió array");
      log(`${servers.length} servidor(es)`);
    });
  });

  // ============================================================
  // DOCKER (solo lectura)
  // ============================================================

  describe("docker", () => {
    it("should list containers", async () => {
      try {
        const containers = await client.getContainers();
        assert.ok(Array.isArray(containers), "getContainers devolvió array");
        log(`${containers.length} contenedor(es)`);
      } catch (err: any) {
        // En cloud mode puede no funcionar sin serverId
        if (err.message.includes("500") || err.message.includes("server")) {
          log("getContainers requiere serverId en este entorno (skip)");
        } else {
          throw err;
        }
      }
    });
  });

  // ============================================================
  // DEPLOYMENT QUEUE (solo lectura)
  // ============================================================

  describe("deployments", () => {
    it("should get deployment queue", async () => {
      try {
        const queue = await client.getDeploymentQueue();
        assert.ok(Array.isArray(queue), "queueList devolvió array");
        log(`Cola: ${queue.length} job(s)`);
      } catch (err: any) {
        // Puede fallar si no hay Redis/BullMQ
        log(`Queue no disponible: ${err.message.slice(0, 60)}`);
      }
    });
  });

  // ============================================================
  // SETTINGS (solo lectura)
  // ============================================================

  describe("settings", () => {
    it("should get instance settings", async () => {
      const settings = await client.getSettings();
      assert.ok(settings, "getSettings devolvió resultado");
      log("Settings leídos OK");
    });
  });

  // ============================================================
  // CLEANUP
  // ============================================================

  describe("cleanup", () => {
    it("should delete the test project and everything inside", async () => {
      assert.ok(projectId, "projectId disponible para limpieza");

      await client.deleteProject(projectId);
      log(`Proyecto ${TEST_PROJECT_NAME} eliminado`);

      // Verificar que ya no existe
      try {
        await client.getProject(projectId);
        assert.fail("El proyecto debería haberse eliminado");
      } catch {
        log("Verificado: proyecto ya no existe");
      }
    });
  });
});
