import { registry } from "./agent.ts";

for (const tool of registry.values()) console.log(`${tool.permission.padEnd(5)}  ${tool.name}`);
