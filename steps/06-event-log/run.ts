import { runAgent, refundModel, formatLog } from "./agent.ts";

const task = "Customer wants a refund for order 1042.";
const runs: Array<[string, number, string[]]> = [
  ["run 1: no approval", 8, []],
  ["run 2: refund approved", 8, ["issue_refund"]],
  ["run 3: step budget 2", 2, ["issue_refund"]],
];
for (const [label, maxSteps, approved] of runs) {
  console.log(`\n${label}`);
  console.log(formatLog(runAgent(task, refundModel, { maxSteps, approved: new Set(approved) })));
}
