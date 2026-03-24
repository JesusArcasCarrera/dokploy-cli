/**
 * Utilidades de formato de salida para el CLI.
 */

import chalk from "chalk";
import Table from "cli-table3";

export function heading(text: string) {
  console.log(chalk.bold.cyan(`\n${text}\n`));
}

export function success(text: string) {
  console.log(chalk.green(`✓ ${text}`));
}

export function error(text: string) {
  console.error(chalk.red(`✗ ${text}`));
}

export function warn(text: string) {
  console.log(chalk.yellow(`⚠ ${text}`));
}

export function info(text: string) {
  console.log(chalk.dim(text));
}

export function json(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export function table(headers: string[], rows: string[][]) {
  const t = new Table({
    head: headers.map((h) => chalk.bold(h)),
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    t.push(row);
  }
  console.log(t.toString());
}

export function statusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "done":
    case "running":
    case "idle":
      return chalk.green(status);
    case "error":
    case "failed":
      return chalk.red(status);
    case "building":
    case "deploying":
      return chalk.yellow(status);
    default:
      return chalk.dim(status ?? "-");
  }
}

export function truncate(str: string, max = 40): string {
  if (!str) return "-";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function timeAgo(date: string | Date | null): string {
  if (!date) return "-";
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
