import { newContext, loadSkill, refundModel } from "./agent.ts";

const ctx = newContext("Customer wants a refund for order 1042.");
console.log("turn 1:", JSON.stringify(refundModel(ctx)));
loadSkill(ctx, "refunds");
console.log("turn 2:", JSON.stringify(refundModel(ctx)));
