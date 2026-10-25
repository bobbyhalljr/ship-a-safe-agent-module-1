import { runAgent, refundModel } from "./agent.ts";

const ctx = runAgent("Customer wants a refund for order 1042.", refundModel, { maxSteps: 8, approved: new Set() });
for (const e of ctx.events) console.log(JSON.stringify(e));
