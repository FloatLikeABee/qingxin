import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { load } from 'js-yaml';

const OPENAPI_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../api/openapi.yaml'
);

type JsonSchema = Record<string, unknown>;

function rewriteRefs(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(rewriteRefs);
	if (!value || typeof value !== 'object') return value;
	const rec = value as Record<string, unknown>;
	const next: Record<string, unknown> = {};
	for (const [key, nested] of Object.entries(rec)) {
		if (
			key === '$ref' &&
			typeof nested === 'string' &&
			nested.startsWith('#/components/schemas/')
		) {
			next[key] = `https://qingxin.local/schemas/${nested.slice('#/components/schemas/'.length)}`;
		} else {
			next[key] = rewriteRefs(nested);
		}
	}
	return next;
}

function toJsonSchema(value: unknown): unknown {
	const rewritten = rewriteRefs(value);
	if (Array.isArray(rewritten)) return rewritten.map(toJsonSchema);
	if (!rewritten || typeof rewritten !== 'object') return rewritten;
	const rec = rewritten as Record<string, unknown>;
	const next: Record<string, unknown> = {};
	for (const [key, nested] of Object.entries(rec)) {
		if (key === 'nullable') continue;
		next[key] = toJsonSchema(nested);
	}
	if (rec.nullable === true) {
		const type = next.type;
		if (typeof type === 'string') next.type = [type, 'null'];
		else if (Array.isArray(type) && !type.includes('null')) next.type = [...type, 'null'];
	}
	return next;
}

let cached: { ajv: Ajv; names: Set<string> } | undefined;

function compile(): { ajv: Ajv; names: Set<string> } {
	if (cached) return cached;
	const doc = load(readFileSync(OPENAPI_PATH, 'utf8')) as {
		components?: { schemas?: Record<string, unknown> };
	};
	const schemas = doc.components?.schemas ?? {};
	const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: true });
	addFormats(ajv);
	for (const [name, schema] of Object.entries(schemas)) {
		const converted = toJsonSchema(schema) as JsonSchema;
		ajv.addSchema({ ...converted, $id: `https://qingxin.local/schemas/${name}` });
	}
	cached = { ajv, names: new Set(Object.keys(schemas)) };
	return cached;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
	if (!errors?.length) return '';
	return errors
		.map((error) => `${error.instancePath || '/'} ${error.message ?? 'invalid'}`)
		.join('; ');
}

export function validateSchema(name: string, body: unknown): { ok: boolean; errors: string } {
	const { ajv, names } = compile();
	if (!names.has(name)) return { ok: false, errors: `unknown schema ${name}` };
	const validate: ValidateFunction | undefined = ajv.getSchema(
		`https://qingxin.local/schemas/${name}`
	);
	if (!validate) return { ok: false, errors: `could not compile ${name}` };
	const ok = validate(body) === true;
	return { ok, errors: ok ? '' : formatErrors(validate.errors) };
}

export function openApiSchemaNames(): string[] {
	return [...compile().names];
}

export function validateOpenApi(
	schemaName: string,
	body: unknown
): { ok: true } | { ok: false; errors: ErrorObject[] } {
	const result = validateSchema(schemaName, body);
	if (result.ok) return { ok: true };
	return {
		ok: false,
		errors: [
			{ instancePath: '', message: result.errors, keyword: 'error', schemaPath: '', params: {} }
		]
	};
}

export function expectOpenApi(schemaName: string, body: unknown): void {
	const result = validateSchema(schemaName, body);
	if (!result.ok) {
		throw new Error(`${schemaName} failed: ${result.errors}`);
	}
}

export const CAMEL_BAN =
	/avatarUrl|nextDueDate|measuredOn|weightG|contentMd|parentId|targetDays|loggedAt|sortOrder|intervalDays|nextReviewDate|templateId|amountFen|categoryId|occurredOn|clientId|priceFen|nextBillingDate|remindDaysBefore|monthlyLimitFen|alertThresholdPct|targetAmountFen|daysOfWeek|voiceText|sleepAt|wakeAt|startDate|endDate|flowLevel|reportDate|timeLocal/;
