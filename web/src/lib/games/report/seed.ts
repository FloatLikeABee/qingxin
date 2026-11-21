import { type Cell, type Sheet, type Workbook, makeSheet } from './engine';

export const DISCLAIMER = '本表是游戏里的虚构公司数据，不是真实财报，也不连接 Excel。';
export const COMPANY = '青柠示意有限公司';
export const FAKE_CODE = 'QX-SHOW-0001（非 ISIN，演示代码）';

export const TIE_ADDR = {
	row: 24,
	ni: 22,
	assets: 12,
	cash: 19
};

function put(sheet: Sheet, addr: string, raw: string, extra: Partial<Cell> = {}) {
	sheet.cells[addr] = { raw, ...extra };
}

function years(
	sheet: Sheet,
	row: number,
	label: string,
	b: string,
	c: string,
	d: string,
	extra: Partial<Cell> = {}
) {
	put(sheet, `A${row}`, label, { bold: extra.bold });
	put(sheet, `B${row}`, b, extra);
	put(sheet, `C${row}`, c, extra);
	put(sheet, `D${row}`, d, extra);
}

function assumeSheet(): Sheet {
	const s = makeSheet('assume', '假设', 48, 8);
	put(s, 'A1', `${COMPANY} · 虚构演示年报`, { bold: true });
	put(s, 'A2', DISCLAIMER);
	put(s, 'A3', FAKE_CODE);
	put(s, 'A5', '项目', { bold: true });
	put(s, 'B5', '2024', { bold: true });
	put(s, 'C5', '2025', { bold: true });
	put(s, 'D5', '2026', { bold: true });
	put(s, 'E5', '单位', { bold: true });
	put(s, 'F5', '备注', { bold: true });
	const rows: [number, string, string, string, string, string, string, Partial<Cell>?][] = [
		[6, '营收增长率', '0', '0.12', '0.08', '%', '可改。2024 为基年。', { numFmt: 'percent' }],
		[7, '基准营收', '12800', '', '', '万元', '2024 营业收入'],
		[8, '饮品占比', '0.46', '0.46', '0.45', '%', '青柠饮品', { numFmt: 'percent' }],
		[9, '文具占比', '0.32', '0.31', '0.30', '%', '轻心文具', { numFmt: 'percent' }],
		[10, '云服务占比', '0.22', '0.23', '0.25', '%', '示意云', { numFmt: 'percent' }],
		[11, '销货成本率', '0.58', '0.57', '0.56', '%', '', { numFmt: 'percent' }],
		[12, '销售费用率', '0.08', '0.08', '0.07', '%', '', { numFmt: 'percent' }],
		[13, '管理费用率', '0.05', '0.05', '0.05', '%', '', { numFmt: 'percent' }],
		[14, '研发费用率', '0.03', '0.035', '0.04', '%', '', { numFmt: 'percent' }],
		[15, '税率', '0.25', '0.25', '0.25', '%', '', { numFmt: 'percent' }],
		[16, '人数', '86', '92', '98', '人', '备查'],
		[17, '人均薪酬', '18', '18.5', '19', '万元', '备查'],
		[18, '折旧年限', '8', '8', '8', '年', '直线法'],
		[19, '资本开支', '620', '540', '480', '万元', '当年购建'],
		[20, '营运资本占收', '0.18', '0.17', '0.16', '%', '应收+存货-应付', { numFmt: 'percent' }],
		[21, '股利支付率', '0.2', '0.22', '0.24', '%', '', { numFmt: 'percent' }],
		[22, '期初现金', '3210', '', '', '万元', '使期初资产负债表勾稽'],
		[23, '期初应收', '1600', '', '', '万元', ''],
		[24, '期初存货', '980', '', '', '万元', ''],
		[25, '期初应付', '870', '', '', '万元', ''],
		[26, '期初固定资产原值', '5400', '', '', '万元', ''],
		[27, '期初累计折旧', '1260', '', '', '万元', ''],
		[28, '期初借款', '1800', '', '', '万元', '余额保持'],
		[29, '借款利率', '0.045', '0.045', '0.04', '%', '', { numFmt: 'percent' }],
		[30, '其他收益', '80', '90', '100', '万元', ''],
		[31, '股本', '5000', '', '', '万元', ''],
		[32, '期初未分配利润', '2260', '', '', '万元', '']
	];
	for (const [row, label, b, c, d, unit, note, extra] of rows) {
		put(s, `A${row}`, label, { bold: true });
		if (b) put(s, `B${row}`, b, extra);
		if (c) put(s, `C${row}`, c, extra);
		if (d) put(s, `D${row}`, d, extra);
		put(s, `E${row}`, unit);
		put(s, `F${row}`, note);
	}
	put(s, 'A34', '2025 月度季节系数', { bold: true });
	put(s, 'F34', '合计应为 12，月度营收才能加总到年');
	const seasons = [0.7, 0.75, 0.85, 0.95, 1.05, 1.2, 1.15, 1.1, 1.05, 1, 0.95, 1.25];
	seasons.forEach((n, i) => {
		put(s, `A${35 + i}`, `${i + 1}月`);
		put(s, `B${35 + i}`, String(n), { numFmt: 'decimal2' });
	});
	put(s, 'A47', '季节合计');
	put(s, 'B47', '=SUM(B35:B46)', { numFmt: 'decimal2' });
	put(s, 'A48', '支持 + - * /、A1、$A$1、跨表、SUM AVERAGE MIN MAX IF ROUND ABS。不是 Excel。');
	return s;
}

function incomeSheet(): Sheet {
	const s = makeSheet('is', '利润表', 48, 17);
	put(s, 'A1', `${COMPANY} · 利润表`, { bold: true });
	put(s, 'A2', DISCLAIMER);
	put(s, 'A3', '单位：万元');
	put(s, 'A4', '项目', { bold: true });
	put(s, 'B4', '2024', { bold: true });
	put(s, 'C4', '2025', { bold: true });
	put(s, 'D4', '2026', { bold: true });
	put(s, 'E4', '同比', { bold: true });
	for (let m = 0; m < 12; m++)
		put(s, `${String.fromCharCode(70 + m)}4`, `${m + 1}月`, { bold: true });
	years(s, 5, '营业收入', '=假设!B7', '=B5*(1+假设!C6)', '=C5*(1+假设!D6)', { bold: true });
	years(s, 6, '　青柠饮品', '=B5*假设!B8', '=C5*假设!C8', '=D5*假设!D8');
	years(s, 7, '　轻心文具', '=B5*假设!B9', '=C5*假设!C9', '=D5*假设!D9');
	years(s, 8, '　示意云服务', '=B5*假设!B10', '=C5*假设!C10', '=D5*假设!D10');
	years(s, 9, '其他收益', '=假设!B30', '=假设!C30', '=假设!D30');
	years(s, 10, '营业总收入', '=B5+B9', '=C5+C9', '=D5+D9', { bold: true });
	years(s, 11, '销货成本', '=B5*假设!B11', '=C5*假设!C11', '=D5*假设!D11');
	years(s, 12, '毛利', '=B5-B11', '=C5-C11', '=D5-D11', { bold: true });
	years(s, 13, '毛利率', '=IF(B5=0,0,B12/B5)', '=IF(C5=0,0,C12/C5)', '=IF(D5=0,0,D12/D5)', {
		numFmt: 'percent'
	});
	years(s, 14, '销售费用', '=B5*假设!B12', '=C5*假设!C12', '=D5*假设!D12');
	years(s, 15, '管理费用', '=B5*假设!B13', '=C5*假设!C13', '=D5*假设!D13');
	years(s, 16, '研发费用', '=B5*假设!B14', '=C5*假设!C14', '=D5*假设!D14');
	years(
		s,
		17,
		'折旧摊销',
		'=假设!B26/假设!B18',
		'=资产负债表!B9/假设!C18',
		'=资产负债表!C9/假设!D18'
	);
	years(s, 18, '营业利润', '=B12-B14-B15-B16-B17', '=C12-C14-C15-C16-C17', '=D12-D14-D15-D16-D17', {
		bold: true
	});
	years(
		s,
		19,
		'财务费用',
		'=假设!B28*假设!B29',
		'=资产负债表!B15*假设!C29',
		'=资产负债表!C15*假设!D29'
	);
	years(s, 20, '利润总额', '=B18-B19+B9', '=C18-C19+C9', '=D18-D19+D9', { bold: true });
	years(
		s,
		21,
		'所得税',
		'=IF(B20>0,B20*假设!B15,0)',
		'=IF(C20>0,C20*假设!C15,0)',
		'=IF(D20>0,D20*假设!D15,0)'
	);
	years(s, 22, '净利润', '=B20-B21', '=C20-C21', '=D20-D21', { bold: true, fill: '#dbeafe' });
	years(s, 23, '净利率', '=IF(B5=0,0,B22/B5)', '=IF(C5=0,0,C22/C5)', '=IF(D5=0,0,D22/D5)', {
		numFmt: 'percent'
	});
	put(s, 'A24', '同比净利润');
	put(s, 'C24', '=IF(B22=0,0,(C22-B22)/B22)', { numFmt: 'percent' });
	put(s, 'D24', '=IF(C22=0,0,(D22-C22)/C22)', { numFmt: 'percent' });
	put(s, 'E5', '=IF(B5=0,0,(C5-B5)/B5)', { numFmt: 'percent' });
	put(s, 'E22', '=IF(B22=0,0,(C22-B22)/B22)', { numFmt: 'percent' });
	years(s, 25, '职工人数（备查）', '=假设!B16', '=假设!C16', '=假设!D16');
	years(s, 26, '人均薪酬（备查）', '=假设!B17', '=假设!C17', '=假设!D17');
	years(s, 27, '职工薪酬（备查）', '=B25*B26', '=C25*C26', '=D25*D26');
	years(
		s,
		28,
		'人均营收（备查）',
		'=IF(B25=0,0,B5/B25)',
		'=IF(C25=0,0,C5/C25)',
		'=IF(D25=0,0,D5/D25)'
	);
	years(s, 29, '资本开支（备查）', '=假设!B19', '=假设!C19', '=假设!D19');
	for (let m = 0; m < 12; m++) {
		const col = String.fromCharCode(70 + m);
		put(s, `${col}5`, `=$C5*假设!B${35 + m}/SUM(假设!$B$35:$B$46)`);
		put(s, `${col}6`, `=${col}5*假设!C8`);
	}
	put(s, 'A30', '月度营收合计（应等于 2025 年营业收入）');
	put(s, 'C30', '=SUM(F5:Q5)');
	put(s, 'A31', '饮品+文具+云（应等于营业收入）');
	put(s, 'B31', '=B6+B7+B8');
	put(s, 'C31', '=C6+C7+C8');
	put(s, 'D31', '=D6+D7+D8');
	put(s, 'A33', '费用结构');
	years(s, 34, '销售费用占收', '=IF(B5=0,0,B14/B5)', '=IF(C5=0,0,C14/C5)', '=IF(D5=0,0,D14/D5)', {
		numFmt: 'percent'
	});
	years(s, 35, '管理费用占收', '=IF(B5=0,0,B15/B5)', '=IF(C5=0,0,C15/C5)', '=IF(D5=0,0,D15/D5)', {
		numFmt: 'percent'
	});
	years(s, 36, '研发费用占收', '=IF(B5=0,0,B16/B5)', '=IF(C5=0,0,C16/C5)', '=IF(D5=0,0,D16/D5)', {
		numFmt: 'percent'
	});
	put(s, 'A38', '这是游戏里的示意报表。改左边假设，三张表会一起变。');
	return s;
}

function balanceSheet(): Sheet {
	const s = makeSheet('bs', '资产负债表', 40, 6);
	put(s, 'A1', `${COMPANY} · 资产负债表`, { bold: true });
	put(s, 'A2', DISCLAIMER);
	put(s, 'A3', '单位：万元');
	put(s, 'A4', '项目', { bold: true });
	put(s, 'B4', '2024', { bold: true });
	put(s, 'C4', '2025', { bold: true });
	put(s, 'D4', '2026', { bold: true });
	years(s, 5, '货币资金', '=现金流量表!B19', '=现金流量表!C19', '=现金流量表!D19', { bold: true });
	years(s, 6, '应收账款', '=利润表!B5*0.1', '=利润表!C5*0.1', '=利润表!D5*0.1');
	years(s, 7, '存货', '=利润表!B5*0.12', '=利润表!C5*0.12', '=利润表!D5*0.12');
	years(s, 8, '流动资产合计', '=B5+B6+B7', '=C5+C6+C7', '=D5+D6+D7', { bold: true });
	years(s, 9, '固定资产原值', '=假设!B26+假设!B19', '=B9+假设!C19', '=C9+假设!D19');
	years(s, 10, '累计折旧', '=假设!B27+利润表!B17', '=B10+利润表!C17', '=C10+利润表!D17');
	years(s, 11, '固定资产净值', '=B9-B10', '=C9-C10', '=D9-D10');
	years(s, 12, '资产总计', '=B8+B11', '=C8+C11', '=D8+D11', { bold: true, fill: '#dbeafe' });
	years(
		s,
		14,
		'应付账款',
		'=利润表!B5*(0.22-假设!B20)',
		'=利润表!C5*(0.22-假设!C20)',
		'=利润表!D5*(0.22-假设!D20)'
	);
	years(s, 15, '短期借款', '=假设!B28', '=B15', '=C15');
	years(s, 16, '流动负债合计', '=B14+B15', '=C14+C15', '=D14+D15', { bold: true });
	years(s, 17, '负债合计', '=B16', '=C16', '=D16', { bold: true });
	years(s, 19, '股本', '=假设!B31', '=B19', '=C19');
	years(
		s,
		20,
		'未分配利润',
		'=假设!B32+利润表!B22-现金流量表!B14',
		'=B20+利润表!C22-现金流量表!C14',
		'=C20+利润表!D22-现金流量表!D14'
	);
	years(s, 21, '权益合计', '=B19+B20', '=C19+C20', '=D19+D20', { bold: true });
	years(s, 23, '负债和权益总计', '=B17+B21', '=C17+C21', '=D17+D21', {
		bold: true,
		fill: '#dbeafe'
	});
	years(s, 24, '勾稽差额', '=B12-B23', '=C12-C23', '=D12-D23', { bold: true, fill: '#fef3c7' });
	put(s, 'A25', '完整公式下差额应接近 0。乱改硬编码数字会打破勾稽。');
	years(s, 27, '流动比率', '=IF(B16=0,0,B8/B16)', '=IF(C16=0,0,C8/C16)', '=IF(D16=0,0,D8/D16)', {
		numFmt: 'decimal2'
	});
	years(
		s,
		28,
		'资产负债率',
		'=IF(B12=0,0,B17/B12)',
		'=IF(C12=0,0,C17/C12)',
		'=IF(D12=0,0,D17/D12)',
		{
			numFmt: 'percent'
		}
	);
	years(
		s,
		29,
		'应收占收',
		'=IF(利润表!B5=0,0,B6/利润表!B5)',
		'=IF(利润表!C5=0,0,C6/利润表!C5)',
		'=IF(利润表!D5=0,0,D6/利润表!D5)',
		{
			numFmt: 'percent'
		}
	);
	put(s, 'A31', '营运资本');
	put(s, 'B31', '=B6+B7-B14');
	put(s, 'C31', '=C6+C7-C14');
	put(s, 'D31', '=D6+D7-D14');
	put(s, 'A32', '营运资本占收');
	put(s, 'B32', '=IF(利润表!B5=0,0,B31/利润表!B5)', { numFmt: 'percent' });
	put(s, 'C32', '=IF(利润表!C5=0,0,C31/利润表!C5)', { numFmt: 'percent' });
	put(s, 'D32', '=IF(利润表!D5=0,0,D31/利润表!D5)', { numFmt: 'percent' });
	return s;
}

function cashSheet(): Sheet {
	const s = makeSheet('cf', '现金流量表', 36, 6);
	put(s, 'A1', `${COMPANY} · 现金流量表`, { bold: true });
	put(s, 'A2', DISCLAIMER);
	put(s, 'A3', '单位：万元');
	put(s, 'A4', '项目', { bold: true });
	put(s, 'B4', '2024', { bold: true });
	put(s, 'C4', '2025', { bold: true });
	put(s, 'D4', '2026', { bold: true });
	years(s, 5, '净利润', '=利润表!B22', '=利润表!C22', '=利润表!D22', { bold: true });
	years(s, 6, '加：折旧摊销', '=利润表!B17', '=利润表!C17', '=利润表!D17');
	years(
		s,
		7,
		'营运资本增加',
		'=(利润表!B5*假设!B20)-(假设!B23+假设!B24-假设!B25)',
		'=利润表!C5*假设!C20-利润表!B5*假设!B20',
		'=利润表!D5*假设!D20-利润表!C5*假设!C20'
	);
	years(s, 8, '经营现金流', '=B5+B6-B7', '=C5+C6-C7', '=D5+D6-D7', { bold: true });
	years(s, 10, '购建固定资产', '=-假设!B19', '=-假设!C19', '=-假设!D19');
	years(s, 11, '投资现金流', '=B10', '=C10', '=D10', { bold: true });
	years(s, 13, '借款净增加', '0', '0', '0');
	years(s, 14, '分配股利', '=利润表!B22*假设!B21', '=利润表!C22*假设!C21', '=利润表!D22*假设!D21');
	years(s, 15, '筹资现金流', '=B13-B14', '=C13-C14', '=D13-D14', { bold: true });
	years(s, 17, '现金净增加', '=B8+B11+B15', '=C8+C11+C15', '=D8+D11+D15', { bold: true });
	years(s, 18, '期初现金', '=假设!B22', '=B19', '=C19');
	years(s, 19, '期末现金', '=B18+B17', '=C18+C17', '=D18+D17', { bold: true, fill: '#dbeafe' });
	years(
		s,
		21,
		'与资产负债表货币资金核对',
		'=B19-资产负债表!B5',
		'=C19-资产负债表!C5',
		'=D19-资产负债表!D5'
	);
	put(s, 'A23', '经营+投资+筹资应等于现金净增加。');
	put(s, 'B23', '=B8+B11+B15-B17');
	put(s, 'C23', '=C8+C11+C15-C17');
	put(s, 'D23', '=D8+D11+D15-D17');
	put(s, 'A25', '自由现金流（经营+投资）');
	put(s, 'B25', '=B8+B11');
	put(s, 'C25', '=C8+C11');
	put(s, 'D25', '=D8+D11');
	put(s, 'A27', '股利占经营现金流');
	put(s, 'B27', '=IF(B8=0,0,B14/B8)', { numFmt: 'percent' });
	put(s, 'C27', '=IF(C8=0,0,C14/C8)', { numFmt: 'percent' });
	put(s, 'D27', '=IF(D8=0,0,D14/D8)', { numFmt: 'percent' });
	return s;
}

export function createSeedBook(): Workbook {
	return {
		title: '年报',
		company: COMPANY,
		sheets: [assumeSheet(), incomeSheet(), balanceSheet(), cashSheet()],
		active: '假设',
		values: {},
		notice: '改假设页的增长率，利润表、资产负债表和现金流量表会一起重算。',
		recovered: false,
		dockCollapsed: false,
		selection: { sheet: '假设', r0: 5, c0: 2, r1: 5, c1: 2 },
		undo: [],
		redo: []
	};
}
