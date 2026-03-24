#!/usr/bin/env node

import { Command } from "commander";
import { authCmd } from "./commands/auth.js";
import { projectsCmd } from "./commands/projects.js";
import { appsCmd } from "./commands/apps.js";
import { composeCmd } from "./commands/compose.js";
import { deploymentsCmd } from "./commands/deployments.js";
import { serversCmd } from "./commands/servers.js";
import { dockerCmd } from "./commands/docker.js";
import { domainsCmd } from "./commands/domains.js";
import { statusCmd } from "./commands/status.js";
import { envCmd } from "./commands/env.js";
import { logsCmd } from "./commands/logs.js";
import { execCmd } from "./commands/exec.js";

const program = new Command();

program
  .name("dokploy")
  .description("CLI para gestionar despliegues completos en Dokploy")
  .version("0.1.0");

program.addCommand(authCmd);
program.addCommand(statusCmd);
program.addCommand(projectsCmd);
program.addCommand(appsCmd);
program.addCommand(composeCmd);
program.addCommand(deploymentsCmd);
program.addCommand(serversCmd);
program.addCommand(dockerCmd);
program.addCommand(domainsCmd);
program.addCommand(envCmd);
program.addCommand(logsCmd);
program.addCommand(execCmd);

program.parse();
