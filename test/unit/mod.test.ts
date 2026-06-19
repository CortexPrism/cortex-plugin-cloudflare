// deno-lint-ignore-file require-await
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { tools } from '../../mod.ts';
import type { PluginContext, ToolContext } from '../../types.ts';

// Mock PluginContext
const mockContext: PluginContext & ToolContext = {
  pluginId: 'cortex-plugin-cloudflare',
  pluginDir: '/tmp/plugins/cortex-plugin-cloudflare',
  state: {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: async () => ({}),
  },
  config: {
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
  },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  host: {
    registerTool: () => {},
    unregisterTool: () => {},
  },
  sessionId: 'test-session',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
};

function findTool(name: string) {
  const tool = tools.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

Deno.test('tools array — exports all tools', () => {
  assertEquals(tools.length, 4);
  assertEquals(tools[0].definition.name, 'cf_deploy_worker');
  assertEquals(tools[1].definition.name, 'cf_kv_put');
  assertEquals(tools[2].definition.name, 'cf_kv_get');
  assertEquals(tools[3].definition.name, 'cf_d1_query');
});

Deno.test('cf_deploy_worker — rejects empty script', async () => {
  const tool = findTool('cf_deploy_worker');
  const result = await tool.execute({ 'script': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('cf_kv_put — rejects empty namespace_id', async () => {
  const tool = findTool('cf_kv_put');
  const result = await tool.execute({ 'namespace_id': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('cf_kv_get — rejects empty namespace_id', async () => {
  const tool = findTool('cf_kv_get');
  const result = await tool.execute({ 'namespace_id': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('cf_d1_query — rejects empty database_id', async () => {
  const tool = findTool('cf_d1_query');
  const result = await tool.execute({ 'database_id': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('all tools return durationMs', async () => {
  for (const tool of tools) {
    const args: Record<string, unknown> = {};
    const result = await tool.execute(args, mockContext);
    assertEquals(typeof result.durationMs, 'number');
    assertEquals(result.durationMs >= 0, true);
  }
});
