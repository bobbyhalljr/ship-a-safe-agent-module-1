import { registry, checkPermission } from "./agent.ts";

const approved = new Set(["issue_refund"]);
for (const tool of registry.values()) {
  const before = checkPermission(tool, new Set());
  const after = checkPermission(tool, approved);
  const show = (v: ReturnType<typeof checkPermission>) => (v.ok ? "ok" : v.reason);
  console.log(`${tool.name.padEnd(16)} no approval: ${show(before).padEnd(15)} approved: ${show(after)}`);
}
