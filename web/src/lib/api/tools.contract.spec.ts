/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const spec = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), '../../../../api/openapi.yaml'),
	'utf8'
);

const TOOLS_HTTP = [
	{ method: 'get', path: '/v1/tools' },
	{ method: 'get', path: '/v1/tools/tasks' },
	{ method: 'get', path: '/v1/tools/tasks/{id}' },
	{ method: 'put', path: '/v1/tools/{tool_id}/favourite' },
	{ method: 'post', path: '/v1/tools/{tool_id}/run' }
] as const;

const TOOL_RUN_BODY_KEYS = [
	'input_kind',
	'text',
	'url',
	'filename',
	'pdf_base64',
	'resume',
	'jd',
	'filenames',
	'tone',
	'step',
	'topics'
] as const;

function schemaBlock(name: string): string {
	const start = spec.indexOf(`    ${name}:`);
	expect(start).toBeGreaterThanOrEqual(0);
	const rest = spec.slice(start + 4);
	const next = rest.search(/\n    [A-Z][A-Za-z0-9_]+:/);
	return next === -1 ? spec.slice(start) : spec.slice(start, start + 4 + next);
}

describe('toolbox OpenAPI contract', () => {
	it('documents every HttpQingxinApi toolbox path', () => {
		for (const op of TOOLS_HTTP) {
			expect(spec).toContain(`  ${op.path}:`);
			const start = spec.indexOf(`  ${op.path}:`);
			const block = spec.slice(start, start + 800);
			expect(block.toLowerCase()).toContain(`${op.method}:`);
		}
	});

	it('declares every run body key including pdf_base64', () => {
		const block = schemaBlock('ToolRunRequest');
		for (const key of TOOL_RUN_BODY_KEYS) {
			expect(block).toContain(`${key}:`);
		}
	});

	it('declares favourite 200 body with tool_id and favourite', () => {
		const start = spec.indexOf('/v1/tools/{tool_id}/favourite:');
		expect(start).toBeGreaterThanOrEqual(0);
		const end = spec.indexOf('/v1/tools/{tool_id}/run:');
		const block = spec.slice(start, end);
		expect(block).toContain('schema:');
		expect(block).toContain('tool_id:');
		expect(block).toContain('favourite:');
	});
});
