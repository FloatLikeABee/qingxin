import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../api/openapi.yaml');

let validator: Ajv | undefined;
let schemaNames: string[] = [];

function loadAjv(): Ajv {
	if (validator) return validator;
	const spec = parse(readFileSync(specPath, 'utf8')) as {
		components?: { schemas?: Record<string, object> };
	};
	const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: true });
	addFormats(ajv);
	const schemas = spec.components?.schemas ?? {};
	schemaNames = Object.keys(schemas);
	for (const [name, schema] of Object.entries(schemas)) {
		ajv.addSchema(schema, `#/components/schemas/${name}`);
	}
	validator = ajv;
	return ajv;
}

export function openApiSchemaNames(): string[] {
	loadAjv();
	return schemaNames;
}

export function validateOpenApi(
	schemaName: string,
	body: unknown
): { ok: true } | { ok: false; errors: ErrorObject[] } {
	const ajv = loadAjv();
	const validate = ajv.getSchema(`#/components/schemas/${schemaName}`) as
		ValidateFunction | undefined;
	if (!validate) {
		throw new Error(`unknown OpenAPI schema ${schemaName}`);
	}
	if (validate(body)) return { ok: true };
	return { ok: false, errors: (validate.errors ?? []) as ErrorObject[] };
}

export function expectOpenApi(schemaName: string, body: unknown): void {
	const result = validateOpenApi(schemaName, body);
	if (!result.ok) {
		throw new Error(
			`${schemaName} failed: ${result.errors.map((err) => `${err.instancePath} ${err.message}`).join('; ')}`
		);
	}
}
