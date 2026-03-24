/**
 * Cliente HTTP para la API de Dokploy.
 *
 * Dokploy expone dos tipos de endpoint:
 *   - /api/trpc/<procedure>  → tRPC nativo (todas las procedures)
 *   - /api/<path>            → OpenAPI REST (solo procedures con meta openapi)
 *
 * Este cliente usa el endpoint tRPC nativo porque cubre TODAS las procedures.
 *
 * tRPC v11 protocol:
 *   - Query:    GET  /api/trpc/<procedure>?input={encoded json}
 *   - Mutation: POST /api/trpc/<procedure> body: {json: input}  (Content-Type header omitido, tRPC parsea por sí mismo)
 *
 * Auth: header x-api-key
 */

import Conf from "conf";

export interface DokployConfig {
  url: string;
  apiKey: string;
  profile: string;
}

const store = new Conf<Record<string, DokployConfig>>({
  projectName: "dokploy-cli",
  schema: {},
});

// --- Gestión de perfiles ---

export function saveProfile(name: string, cfg: Omit<DokployConfig, "profile">) {
  store.set(name, { ...cfg, profile: name });
}

export function getProfile(name?: string): DokployConfig {
  const key = name ?? store.get("_active" as any) ?? "default";
  const profile = store.get(key as any) as DokployConfig | undefined;
  if (!profile) {
    throw new Error(
      `Perfil "${key}" no encontrado. Usa "dokploy auth login" primero.`
    );
  }
  return profile;
}

export function setActiveProfile(name: string) {
  store.set("_active" as any, name as any);
}

export function listProfiles(): string[] {
  return Object.keys(store.store).filter((k) => k !== "_active");
}

// --- HTTP Client ---

/**
 * Deserializa una respuesta tRPC con superjson.
 *
 * superjson envuelve los datos en { json: <data>, meta?: { ... } }
 * donde meta contiene info de tipos especiales (Date, Map, Set, etc.)
 * Para nuestro uso, las Dates vienen como strings ISO que JS parsea bien,
 * así que extraemos .json directamente.
 */
function deserializeSuperjson(data: unknown): unknown {
  if (data && typeof data === "object" && "json" in data) {
    return (data as any).json;
  }
  return data;
}

export class DokployClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config?: DokployConfig) {
    const cfg = config ?? getProfile();
    this.baseUrl = cfg.url.replace(/\/$/, "");
    this.apiKey = cfg.apiKey;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
    };

    // tRPC v11: mutations envían JSON con Content-Type
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  /**
   * Extrae el dato útil de la respuesta tRPC.
   *
   * Formato tRPC v11 con superjson:
   *   { result: { data: { json: <actual data>, meta?: {...} } } }
   *
   * También puede venir sin superjson wrapper en algunos casos.
   */
  private unwrap<T>(res: unknown): T {
    const result = (res as any)?.result?.data;
    if (result === undefined) return res as T;
    return deserializeSuperjson(result) as T;
  }

  // --- tRPC protocol ---
  // Query:    GET  /api/trpc/<procedure>?input=<url-encoded superjson>
  // Mutation: POST /api/trpc/<procedure>  body: { json: <input> }

  async query<T = unknown>(route: string, input?: Record<string, unknown>): Promise<T> {
    let path = `/api/trpc/${route}`;
    if (input !== undefined) {
      // tRPC v11 con superjson: input se wrappea en { json: input }
      const encoded = encodeURIComponent(JSON.stringify({ json: input }));
      path += `?input=${encoded}`;
    }
    const res = await this.request("GET", path);
    return this.unwrap<T>(res);
  }

  async mutate<T = unknown>(route: string, input?: Record<string, unknown>): Promise<T> {
    const path = `/api/trpc/${route}`;
    // tRPC v11 con superjson: body es { json: input }
    const body = input !== undefined ? { json: input } : { json: {} };
    const res = await this.request("POST", path, body);
    return this.unwrap<T>(res);
  }

  // --- Proyectos ---

  async listProjects() {
    return this.query<any[]>("project.all");
  }

  async getProject(projectId: string) {
    return this.query<any>("project.one", { projectId });
  }

  async createProject(name: string, description?: string) {
    return this.mutate("project.create", { name, description: description ?? "" });
  }

  async deleteProject(projectId: string) {
    return this.mutate("project.remove", { projectId });
  }

  // --- Aplicaciones ---

  async listApplications(projectId?: string) {
    if (projectId) {
      const project = await this.getProject(projectId);
      return project?.applications ?? [];
    }
    return this.query<any[]>("application.all");
  }

  async getApplication(applicationId: string) {
    return this.query<any>("application.one", { applicationId });
  }

  async createApplication(data: {
    name: string;
    appName: string;
    environmentId: string;
    buildType?: string;
    serverId?: string;
  }) {
    return this.mutate("application.create", data);
  }

  async deployApplication(applicationId: string) {
    return this.mutate("application.deploy", { applicationId });
  }

  async redeployApplication(applicationId: string) {
    return this.mutate("application.redeploy", { applicationId });
  }

  async updateApplication(applicationId: string, data: Record<string, unknown>) {
    return this.mutate("application.update", { applicationId, ...data });
  }

  // --- Compose ---

  async listComposes(projectId?: string) {
    if (projectId) {
      const project = await this.getProject(projectId);
      return project?.compose ?? [];
    }
    return this.query<any[]>("compose.all");
  }

  async getCompose(composeId: string) {
    return this.query<any>("compose.one", { composeId });
  }

  async createCompose(data: {
    name: string;
    appName: string;
    environmentId: string;
    serverId?: string;
  }) {
    return this.mutate("compose.create", data);
  }

  async deployCompose(composeId: string) {
    return this.mutate("compose.deploy", { composeId });
  }

  async redeployCompose(composeId: string) {
    return this.mutate("compose.redeploy", { composeId });
  }

  // --- Deployments ---

  async listDeployments(applicationId: string) {
    return this.query<any[]>("deployment.all", { applicationId });
  }

  async listDeploymentsByCompose(composeId: string) {
    return this.query<any[]>("deployment.allByCompose", { composeId });
  }

  async listDeploymentsCentralized() {
    return this.query<any[]>("deployment.allCentralized");
  }

  async getDeploymentQueue() {
    return this.query<any[]>("deployment.queueList");
  }

  // --- Dominios ---

  async listDomains(applicationId: string) {
    return this.query<any[]>("domain.byApplicationId", { applicationId });
  }

  async createDomain(data: {
    applicationId?: string;
    composeId?: string;
    host: string;
    port?: number;
    https?: boolean;
  }) {
    return this.mutate("domain.create", data);
  }

  // --- Servidores ---

  async listServers() {
    return this.query<any[]>("server.all");
  }

  async getServer(serverId: string) {
    return this.query<any>("server.one", { serverId });
  }

  // --- Bases de datos ---

  async listDatabases(projectId: string) {
    const project = await this.getProject(projectId);
    return {
      postgres: project?.postgres ?? [],
      mysql: project?.mysql ?? [],
      mongo: project?.mongo ?? [],
      redis: project?.redis ?? [],
      mariadb: project?.mariadb ?? [],
    };
  }

  // --- Environments ---

  async listEnvironments(projectId: string) {
    const project = await this.getProject(projectId);
    return project?.environments ?? [];
  }

  // --- Settings ---

  async getSettings() {
    return this.query<any>("settings.getWebServerSettings");
  }

  // --- Docker ---

  async getContainers(serverId?: string) {
    return this.query<any[]>("docker.getContainers", serverId ? { serverId } : {});
  }
}
