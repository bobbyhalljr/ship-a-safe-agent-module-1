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

export type Turn =
  | { kind: "load_skill"; name: string }
  | { kind: "call"; name: string; args: Args }
  | { kind: "answer"; text: string };
export type Model = (ctx: Context) => Turn;

const did = (ctx: Context, tool: string) => ctx.events.some((e) => e.type === "tool_result" && e.name === tool);

export const refundModel: Model = (ctx): Turn => {
  const last = ctx.events[ctx.events.length - 1];
  if (!ctx.loadedSkills.has("refunds")) return { kind: "load_skill", name: "refunds" };
  if (!did(ctx, "lookup_order")) return { kind: "call", name: "lookup_order", args: { id: "1042" } };
  if (last.type === "blocked") return { kind: "answer", text: `I need approval before I can ${last.name}.` };
  if (!did(ctx, "issue_refund")) return { kind: "call", name: "issue_refund", args: { id: "1042", amount: "48.00" } };
  return { kind: "answer", text: "Refunded $48.00 on order 1042." };
};

export type Limits = { maxSteps: number; approved: Set<string> };

export function runAgent(task: string, model: Model, limits: Limits): Context {
  const ctx = newContext(task);
  for (let step = 1; step <= limits.maxSteps; step++) {
    const turn = model(ctx);
    if (turn.kind === "answer") {
      ctx.events.push({ type: "answer", text: turn.text });
      return ctx;
    }
    if (turn.kind === "load_skill") {
      loadSkill(ctx, turn.name);
      continue;
    }
    ctx.events.push({ type: "tool_call", name: turn.name, args: turn.args });
    const tool = registry.get(turn.name);
    if (!tool || !ctx.visibleTools.has(turn.name)) {
      ctx.events.push({ type: "blocked", name: turn.name, reason: "not loaded" });
      continue;
    }
    const verdict = checkPermission(tool, limits.approved);
    if (!verdict.ok) {
      ctx.events.push({ type: "blocked", name: turn.name, reason: verdict.reason });
      continue;
    }
    ctx.events.push({ type: "tool_result", name: turn.name, result: tool.run(turn.args) });
  }
  ctx.events.push({ type: "answer", text: `Stopped: step budget of ${limits.maxSteps} reached.` });
  return ctx;
}

export function formatLog(ctx: Context): string {
  const lines = ctx.events.map((e) => {
    switch (e.type) {
      case "user": return `user     ${e.text}`;
      case "skill_loaded": return `skill    loaded ${e.name}`;
      case "tool_call": return `call     ${e.name}(${JSON.stringify(e.args)})`;
      case "tool_result": return `result   ${e.result}`;
      case "blocked": return `BLOCKED  ${e.name}: ${e.reason}`;
      case "answer": return `answer   ${e.text}`;
    }
  });
  return [...lines, `skills in context: ${[...ctx.loadedSkills].join(", ") || "none"}`].join("\n");
}

// ===== EXERCISES: solutions =====

// Exercise 1
export const shippingModel: Model = (ctx): Turn => {
  if (!ctx.loadedSkills.has("shipping")) return { kind: "load_skill", name: "shipping" };
  const result = ctx.events.find((e) => e.type === "tool_result" && e.name === "track_package");
  if (!result) return { kind: "call", name: "track_package", args: { id: "1042" } };
  return { kind: "answer", text: result.type === "tool_result" ? result.result : "" };
};

// Exercise 2
export type BudgetLimits = Limits & { maxToolCalls: number };
export function runAgentWithBudget(task: string, model: Model, limits: BudgetLimits): Context {
  const counted: Model = (ctx) => {
    const calls = ctx.events.filter((e) => e.type === "tool_call").length;
    const turn = model(ctx);
    if (turn.kind === "call" && calls >= limits.maxToolCalls)
      return { kind: "answer", text: `Stopped: tool call budget of ${limits.maxToolCalls} reached.` };
    return turn;
  };
  return runAgent(task, counted, limits);
}

// Exercise 3
export type Summary = { skills: string[]; toolCalls: number; blocked: string[]; answer: string };
export function summarize(ctx: Context): Summary {
  const skills: string[] = [], blocked: string[] = [];
  let toolCalls = 0, answer = "";
  for (const e of ctx.events) {
    if (e.type === "skill_loaded") skills.push(e.name);
    if (e.type === "tool_call") toolCalls++;
    if (e.type === "blocked") blocked.push(`${e.name}: ${e.reason}`);
    if (e.type === "answer") answer = e.text;
  }
  return { skills, toolCalls, blocked, answer };
}
