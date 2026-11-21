import { indexToCol, parseRef, type AbsRef } from './addr';

export type ErrorCode = '#PARSE!' | '#NAME?' | '#REF!' | '#DIV/0!' | '#CYCLE!' | '#VALUE!';

export type Expr =
	| { kind: 'num'; n: number }
	| { kind: 'str'; s: string }
	| { kind: 'ref'; ref: AbsRef }
	| { kind: 'range'; start: AbsRef; end: AbsRef }
	| { kind: 'call'; name: string; args: Expr[] }
	| {
			kind: 'op';
			op: '+' | '-' | '*' | '/' | '>' | '<' | '>=' | '<=' | '=' | '<>';
			left: Expr;
			right: Expr;
	  }
	| { kind: 'neg'; expr: Expr }
	| { kind: 'err'; code: ErrorCode };

export type ParseResult = { ok: true; expr: Expr } | { ok: false; code: ErrorCode };

type Tok =
	| { t: 'num'; n: number }
	| { t: 'str'; s: string }
	| { t: 'id'; s: string }
	| { t: 'ref'; s: string }
	| { t: 'op'; s: string };

export const SUPPORTED_FUNS = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'IF', 'ROUND', 'ABS'] as const;
const FUNS = new Set<string>(SUPPORTED_FUNS);

function tokenize(src: string): Tok[] | null {
	const tokens: Tok[] = [];
	let i = 0;
	while (i < src.length) {
		const ch = src[i]!;
		if (ch === ' ' || ch === '\t') {
			i += 1;
			continue;
		}
		if (ch === '"' || ch === "'") {
			const q = ch;
			i += 1;
			let s = '';
			while (i < src.length && src[i] !== q) {
				s += src[i];
				i += 1;
			}
			if (src[i] !== q) return null;
			i += 1;
			tokens.push({ t: 'str', s });
			continue;
		}
		if (ch >= '0' && ch <= '9') {
			let n = '';
			while (i < src.length && /[0-9.]/.test(src[i]!)) {
				n += src[i];
				i += 1;
			}
			const value = Number(n);
			if (!Number.isFinite(value)) return null;
			tokens.push({ t: 'num', n: value });
			continue;
		}
		if (ch === '>' || ch === '<' || ch === '=') {
			let s = ch;
			i += 1;
			if ((ch === '>' || ch === '<') && src[i] === '=') {
				s += '=';
				i += 1;
			} else if (ch === '<' && src[i] === '>') {
				s += '>';
				i += 1;
			}
			tokens.push({ t: 'op', s });
			continue;
		}
		if ('+-*/(),:'.includes(ch)) {
			tokens.push({ t: 'op', s: ch });
			i += 1;
			continue;
		}
		if (ch === '$' || /[A-Za-z\u4e00-\u9fff]/.test(ch)) {
			let s = '';
			while (i < src.length && /[A-Za-z0-9_$\u4e00-\u9fff!]/.test(src[i]!)) {
				s += src[i];
				i += 1;
			}
			if (/^(?:[^!]+!)?\$?[A-Za-z]+\$?\d+$/.test(s)) tokens.push({ t: 'ref', s });
			else tokens.push({ t: 'id', s });
			continue;
		}
		return null;
	}
	return tokens;
}

class Parser {
	i = 0;
	constructor(
		readonly tokens: Tok[],
		readonly sheet: string
	) {}

	peek(): Tok | undefined {
		return this.tokens[this.i];
	}

	take(): Tok | undefined {
		return this.tokens[this.i++];
	}

	opS(tok: Tok | undefined): string | undefined {
		return tok?.t === 'op' ? tok.s : undefined;
	}

	eat(op: string): boolean {
		if (this.opS(this.peek()) === op) {
			this.i += 1;
			return true;
		}
		return false;
	}

	expr(): Expr {
		return this.comp();
	}

	comp(): Expr {
		let left = this.add();
		const ops = new Set(['>', '<', '>=', '<=', '=', '<>']);
		while (ops.has(this.opS(this.peek()) ?? '')) {
			const op = this.opS(this.take()) as '>' | '<' | '>=' | '<=' | '=' | '<>';
			left = { kind: 'op', op, left, right: this.add() };
		}
		return left;
	}

	add(): Expr {
		let left = this.mul();
		while (this.opS(this.peek()) === '+' || this.opS(this.peek()) === '-') {
			const op = this.opS(this.take()) as '+' | '-';
			left = { kind: 'op', op, left, right: this.mul() };
		}
		return left;
	}

	mul(): Expr {
		let left = this.unary();
		while (this.opS(this.peek()) === '*' || this.opS(this.peek()) === '/') {
			const op = this.opS(this.take()) as '*' | '/';
			left = { kind: 'op', op, left, right: this.unary() };
		}
		return left;
	}

	unary(): Expr {
		if (this.eat('-')) return { kind: 'neg', expr: this.unary() };
		if (this.eat('+')) return this.unary();
		return this.primary();
	}

	primary(): Expr {
		const tok = this.peek();
		if (!tok) return { kind: 'err', code: '#PARSE!' };
		if (tok.t === 'num') {
			this.take();
			return { kind: 'num', n: tok.n };
		}
		if (tok.t === 'str') {
			this.take();
			return { kind: 'str', s: tok.s };
		}
		if (tok.t === 'ref') {
			this.take();
			const start = parseRef(tok.s, this.sheet);
			if (!start) return { kind: 'err', code: '#REF!' };
			if (this.eat(':')) {
				const next = this.take();
				if (!next || next.t !== 'ref') return { kind: 'err', code: '#PARSE!' };
				const end = parseRef(next.s, this.sheet);
				if (!end) return { kind: 'err', code: '#REF!' };
				return { kind: 'range', start, end };
			}
			return { kind: 'ref', ref: start };
		}
		if (tok.t === 'id') {
			this.take();
			if (!this.eat('(')) return { kind: 'err', code: '#PARSE!' };
			const args: Expr[] = [];
			if (!this.eat(')')) {
				args.push(this.expr());
				while (this.eat(',')) args.push(this.expr());
				if (!this.eat(')')) return { kind: 'err', code: '#PARSE!' };
			}
			if (!FUNS.has(tok.s.toUpperCase())) return { kind: 'err', code: '#NAME?' };
			return { kind: 'call', name: tok.s.toUpperCase(), args };
		}
		if (tok.t === 'op' && tok.s === '(') {
			this.take();
			const inner = this.expr();
			if (!this.eat(')')) return { kind: 'err', code: '#PARSE!' };
			return inner;
		}
		return { kind: 'err', code: '#PARSE!' };
	}
}

export function parseFormula(raw: string, sheet: string): ParseResult {
	if (!raw.startsWith('=')) return { ok: false, code: '#PARSE!' };
	const tokens = tokenize(raw.slice(1));
	if (!tokens) return { ok: false, code: '#PARSE!' };
	try {
		const parser = new Parser(tokens, sheet);
		const expr = parser.expr();
		if (parser.i !== tokens.length) return { ok: false, code: '#PARSE!' };
		if (expr.kind === 'err') return { ok: false, code: expr.code };
		return { ok: true, expr };
	} catch {
		return { ok: false, code: '#PARSE!' };
	}
}

export function collectRefs(expr: Expr, out: AbsRef[] = []): AbsRef[] {
	if (expr.kind === 'ref') out.push(expr.ref);
	else if (expr.kind === 'range') {
		const r0 = Math.min(expr.start.row, expr.end.row);
		const r1 = Math.max(expr.start.row, expr.end.row);
		const c0 = Math.min(expr.start.col, expr.end.col);
		const c1 = Math.max(expr.start.col, expr.end.col);
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				out.push({
					sheet: expr.start.sheet,
					row: r,
					col: c,
					absRow: false,
					absCol: false,
					a1: `${indexToCol(c)}${r + 1}`
				});
			}
		}
	} else if (expr.kind === 'op') {
		collectRefs(expr.left, out);
		collectRefs(expr.right, out);
	} else if (expr.kind === 'neg') collectRefs(expr.expr, out);
	else if (expr.kind === 'call') for (const arg of expr.args) collectRefs(arg, out);
	return out;
}
