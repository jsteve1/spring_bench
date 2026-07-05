#!/usr/bin/env node
/**
 * MODERN-02 / LEGACY-06: diff /v3/api-docs between legacy and modern shells.
 * Exit 0 when identical (after normalization), 1 when different.
 */
const legacyUrl = process.env.LEGACY_URL || 'http://localhost:8081';
const modernUrl = process.env.MODERN_URL || 'http://localhost:8080';

function normalize(doc) {
  const copy = structuredClone(doc);
  delete copy.servers;
  if (copy.info) {
    delete copy.info.version;
  }
  return copy;
}

async function fetchOpenApi(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/v3/api-docs`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const legacy = normalize(await fetchOpenApi(legacyUrl));
const modern = normalize(await fetchOpenApi(modernUrl));
const legacyJson = JSON.stringify(legacy, null, 2);
const modernJson = JSON.stringify(modern, null, 2);

if (legacyJson === modernJson) {
  console.log('OpenAPI docs match (legacy vs modern).');
  process.exit(0);
}

console.error('OpenAPI docs differ between legacy and modern shells.');
console.error(`Legacy: ${legacyUrl}/v3/api-docs`);
console.error(`Modern: ${modernUrl}/v3/api-docs`);
process.exit(1);
