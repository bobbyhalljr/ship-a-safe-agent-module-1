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
