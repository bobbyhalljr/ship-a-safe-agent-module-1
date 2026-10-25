// Ship a Safe Agent, Module 1: the loop.
// One agent, one context, limits in the harness. Fake model. No API key. No network.

// Step 1: tools live in a registry
type Permission = "allow" | "ask" | "deny";
type Tool = { name: string; description: string; permission: Permission; run: (args: Record<string, string>) => string };

const registry = new Map<string, Tool>();
function register(tool: Tool) { registry.set(tool.name, tool); }

register({ name: "lookup_order", description: "Get an order by id.", permission: "allow",
  run: ({ id }) => `order ${id}: $48.00, placed 12 days ago, card ending 4242` });
register({ name: "issue_refund", description: "Refund an order to the original card.", permission: "ask",
  run: ({ id, amount }) => `refunded $${amount} on order ${id}` });
register({ name: "delete_customer", description: "Delete a customer record.", permission: "deny",
  run: () => "deleted" });
register({ name: "track_package", description: "Carrier tracking for an order.", permission: "allow",
  run: ({ id }) => `order ${id}: delivered` });

// Step 2: skills load on demand
type Skill = { name: string; description: string; body: string; tools: string[] };
const skills: Skill[] = [
  { name: "refunds", description: "Refund or credit a customer order.",
    body: "Full refund within 30 days to the original card. After 30 days, store credit only.",
    tools: ["lookup_order", "issue_refund"] },
  { name: "shipping", description: "Track or reroute a package.",
    body: "Reroutes allowed until the label is printed.", tools: ["track_package"] },
];

// Step 3: the context is the only memory
type Event =
  | { type: "user"; text: string }
  | { type: "skill_loaded"; name: string }
  | { type: "tool_call"; name: string; args: Record<string, string> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "blocked"; name: string; reason: string }
  | { type: "answer"; text: string };

type Context = { events: Event[]; loadedSkills: Set<string>; visibleTools: Set<string> };

function systemPrompt(ctx: Context): string {
  const catalog = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  const loaded = skills.filter((s) => ctx.loadedSkills.has(s.name)).map((s) => s.body).join("\n");
  return `Skills:\n${catalog}\n${loaded}`;
}

// Step 4: a fake model that only reads the context
type Turn =
  | { kind: "load_skill"; name: string }
  | { kind: "call"; name: string; args: Record<string, string> }
  | { kind: "answer"; text: string };

function fakeModel(ctx: Context): Turn {
  const last = ctx.events[ctx.events.length - 1];
  if (!ctx.loadedSkills.has("refunds")) return { kind: "load_skill", name: "refunds" };
  const looked = ctx.events.some((e) => e.type === "tool_result" && e.name === "lookup_order");
  if (!looked) return { kind: "call", name: "lookup_order", args: { id: "1042" } };
  if (last.type === "blocked") return { kind: "answer", text: `I need approval before I can ${last.name}.` };
  const refunded = ctx.events.some((e) => e.type === "tool_result" && e.name === "issue_refund");
  if (!refunded) return { kind: "call", name: "issue_refund", args: { id: "1042", amount: "48.00" } };
  return { kind: "answer", text: "Refunded $48.00 on order 1042." };
}

// Step 5: the loop, with limits in the harness
type Limits = { maxSteps: number; approved: Set<string> };

function runAgent(task: string, limits: Limits): Context {
  const ctx: Context = { events: [{ type: "user", text: task }], loadedSkills: new Set(), visibleTools: new Set() };
  for (let step = 1; step <= limits.maxSteps; step++) {
    const turn = fakeModel(ctx);
    if (turn.kind === "answer") { ctx.events.push({ type: "answer", text: turn.text }); return ctx; }
    if (turn.kind === "load_skill") {
      const skill = skills.find((s) => s.name === turn.name);
      if (skill) { ctx.loadedSkills.add(skill.name); skill.tools.forEach((t) => ctx.visibleTools.add(t)); }
      ctx.events.push({ type: "skill_loaded", name: turn.name });
      continue;
    }
    ctx.events.push({ type: "tool_call", name: turn.name, args: turn.args });
    const tool = registry.get(turn.name);
    if (!tool || !ctx.visibleTools.has(turn.name)) { ctx.events.push({ type: "blocked", name: turn.name, reason: "not loaded" }); continue; }
    if (tool.permission === "deny") { ctx.events.push({ type: "blocked", name: turn.name, reason: "denied" }); continue; }
    if (tool.permission === "ask" && !limits.approved.has(turn.name)) {
      ctx.events.push({ type: "blocked", name: turn.name, reason: "needs approval" });
      continue;
    }
    ctx.events.push({ type: "tool_result", name: turn.name, result: tool.run(turn.args) });
  }
  ctx.events.push({ type: "answer", text: `Stopped: step budget of ${limits.maxSteps} reached.` });
  return ctx;
}

// Step 6: run it and read the event log
function show(label: string, ctx: Context) {
  console.log(`\n${label}`);
  for (const e of ctx.events) {
    if (e.type === "user") console.log(`  user     ${e.text}`);
    if (e.type === "skill_loaded") console.log(`  skill    loaded ${e.name}`);
    if (e.type === "tool_call") console.log(`  call     ${e.name}(${JSON.stringify(e.args)})`);
    if (e.type === "tool_result") console.log(`  result   ${e.result}`);
    if (e.type === "blocked") console.log(`  BLOCKED  ${e.name}: ${e.reason}`);
    if (e.type === "answer") console.log(`  answer   ${e.text}`);
  }
  console.log(`  skills in context: ${[...ctx.loadedSkills].join(", ")}`);
}

const task = "Customer wants a refund for order 1042.";
console.log("Ship a Safe Agent, Module 1 (fake model, no API key)");
show("run 1: no approval", runAgent(task, { maxSteps: 8, approved: new Set() }));
show("run 2: refund approved", runAgent(task, { maxSteps: 8, approved: new Set(["issue_refund"]) }));
show("run 3: step budget 2", runAgent(task, { maxSteps: 2, approved: new Set(["issue_refund"]) }));
