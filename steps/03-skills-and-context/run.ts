import { newContext, loadSkill, systemPrompt } from "./agent.ts";

const ctx = newContext("Customer wants a refund for order 1042.");
console.log("visible before:", [...ctx.visibleTools].join(", ") || "none");
loadSkill(ctx, "refunds");
console.log("visible after: ", [...ctx.visibleTools].join(", "));
console.log("\n" + systemPrompt(ctx));
