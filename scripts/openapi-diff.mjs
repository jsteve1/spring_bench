#!/usr/bin/env node
/**
 * MODERN-02 / LEGACY-06: diff /v3/api-docs between legacy and modern shells.
 * Compares HTTP paths, methods, response codes, and DTO property shapes — ignoring
 * springdoc version noise (OpenAPI 3.0 vs 3.1, operationId, etc.).
 */
const legacyUrl = process.env.LEGACY_URL || 'http://localhost:8081';
const modernUrl = process.env.MODERN_URL || 'http://localhost:8080';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

function schemaShape(schema) {
  if (!schema) {
    return {};
  }
  if (schema.$ref) {
    return { ref: schema.$ref.replace(/^.*\//, '') };
  }
  const properties = {};
  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    if (def.$ref) {
      properties[name] = { ref: def.$ref.replace(/^.*\//, '') };
    } else if (def.type === 'array' && def.items?.$ref) {
      properties[name] = { arrayOf: def.items.$ref.replace(/^.*\//, '') };
    } else {
      properties[name] = { type: def.type ?? 'object' };
    }
  }
  return sortKeys({
    type: schema.type,
    required: [...(schema.required ?? [])].sort(),
    properties,
  });
}

function contractView(doc) {
  const paths = {};
  for (const [path, ops] of Object.entries(doc.paths ?? {})) {
    paths[path] = {};
    for (const [method, op] of Object.entries(ops)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }
      paths[path][method] = sortKeys({
        responses: Object.keys(op.responses ?? {}).sort(),
        requestBody: Boolean(op.requestBody),
        parameters: (op.parameters ?? [])
            .map((p) => `${p.in}:${p.name}:${Boolean(p.required)}`)
            .sort(),
      });
    }
  }

  const schemas = {};
  for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
    schemas[name] = schemaShape(schema);
  }

  return sortKeys({ paths, schemas });
}

async function fetchOpenApi(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/v3/api-docs`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const legacy = contractView(await fetchOpenApi(legacyUrl));
const modern = contractView(await fetchOpenApi(modernUrl));
const legacyJson = JSON.stringify(legacy, null, 2);
const modernJson = JSON.stringify(modern, null, 2);

if (legacyJson === modernJson) {
  console.log('OpenAPI contract signatures match (legacy vs modern).');
  process.exit(0);
}

console.error('OpenAPI contract signatures differ between legacy and modern shells.');
console.error(`Legacy: ${legacyUrl}/v3/api-docs`);
console.error(`Modern: ${modernUrl}/v3/api-docs`);
process.exit(1);
