import type { PluginContext, Tool, ToolCallResult, ToolContext } from './types.ts';

let config: Record<string, string> = {};

export async function onLoad(ctx: PluginContext): Promise<void> {
  ctx.logger.info(`[cortex-plugin-cloudflare] Loaded`);
  config = {
    cfApiToken: (await ctx.config.get('cfApiToken')) ?? '',
    cfAccountId: (await ctx.config.get('cfAccountId')) ?? '',
    cfZoneId: (await ctx.config.get('cfZoneId')) ?? '',
  };
}

export async function onUnload(_ctx: PluginContext): Promise<void> {}

const CF_API = 'https://api.cloudflare.com/client/v4';

async function cfRequest(path: string, method: string, body?: unknown): Promise<string> {
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${config.cfApiToken}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${CF_API}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json.errors || json));
  return JSON.stringify(json, null, 2);
}

const cf_deploy_worker: Tool = {
  definition: {
    name: 'cf_deploy_worker',
    description: 'Deploy a Cloudflare Worker',
    params: [
      { name: 'script', type: 'string', description: 'Worker script content', required: true },
      { name: 'worker_name', type: 'string', description: 'Worker name', required: true },
      { name: 'route', type: 'string', description: 'Route pattern', required: false },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const script = args.script as string;
      const workerName = args.worker_name as string;
      if (!script || !workerName) {
        return {
          toolName: 'cf_deploy_worker',
          success: false,
          output: '',
          error: 'script and worker_name are required',
          durationMs: Date.now() - start,
        };
      }
      const body = { name: workerName, script, type: 'esm' };
      const output = await cfRequest(
        `/accounts/${config.cfAccountId}/workers/scripts/${workerName}`,
        'PUT',
        body,
      );
      return {
        toolName: 'cf_deploy_worker',
        success: true,
        output,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cf_deploy_worker',
        success: false,
        output: '',
        error: `Failed to deploy worker: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cf_kv_put: Tool = {
  definition: {
    name: 'cf_kv_put',
    description: 'Put a value into KV store',
    params: [
      { name: 'namespace_id', type: 'string', description: 'KV namespace ID', required: true },
      { name: 'key', type: 'string', description: 'Key name', required: true },
      { name: 'value', type: 'string', description: 'Value to store', required: true },
      {
        name: 'expiration_ttl',
        type: 'number',
        description: 'Expiration TTL in seconds',
        required: false,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const namespaceId = args.namespace_id as string;
      const key = args.key as string;
      const value = args.value as string;
      if (!namespaceId || !key || value === undefined) {
        return {
          toolName: 'cf_kv_put',
          success: false,
          output: '',
          error: 'namespace_id, key, and value are required',
          durationMs: Date.now() - start,
        };
      }

      const encodedKey = encodeURIComponent(key);
      let path =
        `/accounts/${config.cfAccountId}/storage/kv/namespaces/${namespaceId}/values/${encodedKey}`;
      if (args.expiration_ttl) path += `?expiration_ttl=${args.expiration_ttl}`;

      const res = await fetch(`${CF_API}${path}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${config.cfApiToken}` },
        body: value,
      });
      const json = await res.json();
      return {
        toolName: 'cf_kv_put',
        success: res.ok,
        output: JSON.stringify(json, null, 2),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cf_kv_put',
        success: false,
        output: '',
        error: `Failed to put KV: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cf_kv_get: Tool = {
  definition: {
    name: 'cf_kv_get',
    description: 'Get a value from KV store',
    params: [
      { name: 'namespace_id', type: 'string', description: 'KV namespace ID', required: true },
      { name: 'key', type: 'string', description: 'Key name', required: true },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const namespaceId = args.namespace_id as string;
      const key = args.key as string;
      if (!namespaceId || !key) {
        return {
          toolName: 'cf_kv_get',
          success: false,
          output: '',
          error: 'namespace_id and key are required',
          durationMs: Date.now() - start,
        };
      }
      const res = await fetch(
        `${CF_API}/accounts/${config.cfAccountId}/storage/kv/namespaces/${namespaceId}/values/${
          encodeURIComponent(key)
        }`,
        {
          headers: { Authorization: `Bearer ${config.cfApiToken}` },
        },
      );
      const text = await res.text();
      return {
        toolName: 'cf_kv_get',
        success: res.ok,
        output: text,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cf_kv_get',
        success: false,
        output: '',
        error: `Failed to get KV: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cf_d1_query: Tool = {
  definition: {
    name: 'cf_d1_query',
    description: 'Query a D1 database',
    params: [
      { name: 'database_id', type: 'string', description: 'D1 database ID', required: true },
      { name: 'query', type: 'string', description: 'SQL query to execute', required: true },
      {
        name: 'params',
        type: 'string',
        description: 'Query parameters as JSON array',
        required: false,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const databaseId = args.database_id as string;
      const query = args.query as string;
      if (!databaseId || !query) {
        return {
          toolName: 'cf_d1_query',
          success: false,
          output: '',
          error: 'database_id and query are required',
          durationMs: Date.now() - start,
        };
      }
      let queryParams: unknown[] = [];
      if (args.params) {
        try {
          queryParams = JSON.parse(args.params as string);
        } catch {
          return {
            toolName: 'cf_d1_query',
            success: false,
            output: '',
            error: 'Invalid params JSON',
            durationMs: Date.now() - start,
          };
        }
      }

      const body = { sql: query, params: queryParams };
      const output = await cfRequest(
        `/accounts/${config.cfAccountId}/d1/database/${databaseId}/query`,
        'POST',
        body,
      );
      return { toolName: 'cf_d1_query', success: true, output, durationMs: Date.now() - start };
    } catch (error) {
      return {
        toolName: 'cf_d1_query',
        success: false,
        output: '',
        error: `Failed to query D1: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cf_list_zones: Tool = {
  definition: {
    name: 'cf_list_zones',
    description: 'List DNS zones',
    params: [],
    capabilities: ['network:fetch'],
  },
  execute: async (_args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const output = await cfRequest('/zones', 'GET');
      return { toolName: 'cf_list_zones', success: true, output, durationMs: Date.now() - start };
    } catch (error) {
      return {
        toolName: 'cf_list_zones',
        success: false,
        output: '',
        error: `Failed to list zones: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

export const tools: Tool[] = [cf_deploy_worker, cf_kv_put, cf_kv_get, cf_d1_query, cf_list_zones];
