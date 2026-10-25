// Ship a Safe Agent, Module 1: the loop.
// Fake model. No API key. No network.

export type Permission = "allow" | "ask" | "deny";
export type Args = Record<string, string>;
export type Tool = { name: string; description: string; permission: Permission; run: (args: Args) => string };

export const registry = new Map<string, Tool>();
export function register(tool: Tool): void {
  if (registry.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
  registry.set(tool.name, tool);
}

register({ name: "lookup_order", description: "Get an order by id.", permission: "allow",
  run: ({ id }) => `order ${id}: $48.00, placed 12 days ago` });
register({ name: "issue_refund", description: "Refund an order to the original card.", permission: "ask",
  run: ({ id, amount }) => `refunded $${amount} on order ${id}` });
register({ name: "delete_customer", description: "Delete a customer record.", permission: "deny",
  run: () => "deleted" });
register({ name: "track_package", description: "Carrier tracking for an order.", permission: "allow",
  run: ({ id }) => `order ${id}: out for delivery` });

export type Verdict = { ok: true } | { ok: false; reason: string };

export function checkPermission(tool: Tool, approved: Set<string>): Verdict {
  if (tool.permission === "deny") return { ok: false, reason: "denied" };
  if (tool.permission === "ask" && !approved.has(tool.name)) return { ok: false, reason: "needs approval" };
  return { ok: true };
}

export type Skill = { name: string; description: string; body: string; tools: string[] };
export const skills: Skill[] = [
  { name: "refunds", description: "Refund or credit a customer order.",
    body: "Full refund within 30 days to the original card. After 30 days, store credit only.",
    tools: ["lookup_order", "issue_refund"] },
  { name: "shipping", description: "Track or reroute a package.",
    body: "Reroutes allowed until the label is printed.", tools: ["track_package"] },
];

export type Event =
  | { type: "user"; text: string }
  | { type: "skill_loaded"; name: string }
  | { type: "tool_call"; name: string; args: Args }
  | { type: "tool_result"; name: string; result: string }
  | { type: "blocked"; name: string; reason: string }
  | { type: "answer"; text: string };

export type Context = { events: Event[]; loadedSkills: Set<string>; visibleTools: Set<string> };

export function newContext(task: string): Context {
  return { events: [{ type: "user", text: task }], loadedSkills: new Set(), visibleTools: new Set() };
}

export function loadSkill(ctx: Context, name: string): void {
  const skill = skills.find((s) => s.name === name);
  if (!skill || ctx.loadedSkills.has(name)) return;
  ctx.loadedSkills.add(name);
  skill.tools.forEach((t) => ctx.visibleTools.add(t));
  ctx.events.push({ type: "skill_loaded", name });
}

// What you would send a real model: every description, only the loaded bodies.
export function systemPrompt(ctx: Context): string {
  const catalog = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  const loaded = skills.filter((s) => ctx.loadedSkills.has(s.name)).map((s) => s.body).join("\n");
  return `Skills:\n${catalog}\n\n${loaded}`.trim();
}
