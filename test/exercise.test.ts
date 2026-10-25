import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent, refundModel, shippingModel, runAgentWithBudget, summarize } from "../exercise/agent.ts";

const none = new Set<string>();

test("exercise 1: shippingModel tracks the package", () => {
  const ctx = runAgent("Where is my package for order 1042?", shippingModel, { maxSteps: 8, approved: none });
  const s = summarize(ctx);
  assert.deepEqual(s.skills, ["shipping"]);
  assert.equal(s.answer, "order 1042: out for delivery");
});

test("exercise 1: refund tools never become visible", () => {
  const ctx = runAgent("Where is my package for order 1042?", shippingModel, { maxSteps: 8, approved: none });
  assert.equal(ctx.visibleTools.has("issue_refund"), false);
  assert.equal(ctx.events.some((e) => e.type === "tool_call" && e.name !== "track_package"), false);
});

test("exercise 2: tool call budget stops the run", () => {
  const ctx = runAgentWithBudget("refund 1042", refundModel, { maxSteps: 8, approved: new Set(["issue_refund"]), maxToolCalls: 1 });
  assert.equal(summarize(ctx).toolCalls, 1);
  assert.equal(summarize(ctx).answer, "Stopped: tool call budget of 1 reached.");
});

test("exercise 2: a big enough budget changes nothing", () => {
  const ctx = runAgentWithBudget("refund 1042", refundModel, { maxSteps: 8, approved: new Set(["issue_refund"]), maxToolCalls: 5 });
  assert.equal(summarize(ctx).answer, "Refunded $48.00 on order 1042.");
});

test("exercise 3: summarize reports blocks", () => {
  const ctx = runAgent("refund 1042", refundModel, { maxSteps: 8, approved: none });
  assert.deepEqual(summarize(ctx), {
    skills: ["refunds"], toolCalls: 2, blocked: ["issue_refund: needs approval"],
    answer: "I need approval before I can issue_refund.",
  });
});
