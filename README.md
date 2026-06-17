# cortex-plugin-cloudflare

Deploy edge functions, manage KV, D1 databases on Cloudflare.

## Installation

```bash
cortex plugin install marketplace:cortex-plugin-cloudflare
cortex plugin install github:CortexPrism/cortex-plugin-cloudflare
cortex plugin install ./manifest.json
```

## Quick Start

```bash
cortex tools list
cortex chat --plugin cortex-plugin-cloudflare
```

## Tools

### cf_deploy_worker — Deploy a Cloudflare Worker

- `script` (string, required)
- `worker_name` (string, required)
- `route` (string)

### cf_kv_put — Put a value into KV store

- `namespace_id` (string, required)
- `key` (string, required)
- `value` (string, required)
- `expiration_ttl` (number, seconds)

### cf_kv_get — Get a value from KV store

- `namespace_id` (string, required)
- `key` (string, required)

### cf_d1_query — Query a D1 database

- `database_id` (string, required)
- `query` (string, required)
- `params` (string, JSON array)

### cf_list_zones — List DNS zones

No parameters.

## Configuration

```json
{
  "plugins": {
    "cortex-plugin-cloudflare": {
      "enabled": true,
      "config": {
        "cfApiToken": "",
        "cfAccountId": "",
        "cfZoneId": ""
      }
    }
  }
}
```

## Development

```bash
deno task test
deno task lint
deno task validate
```

## License

MIT
