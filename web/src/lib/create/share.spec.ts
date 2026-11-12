import { describe, expect, it, vi } from 'vitest';
import { formatSharePack, SHARE_TARGETS, shareViaOfficial } from './share';

describe('content share packs', () => {
	it('lists official social targets including 小红书 and 微信', () => {
		expect(SHARE_TARGETS).toEqual(['小红书', '微信', '抖音', '公众号']);
	});

	it('formats a 小红书 pack with hashtags and no unofficial endpoint', () => {
		const pack = formatSharePack('小红书', {
			title: '阳台种菜',
			body: '一块托盘也能长出夏天。',
			tags: ['种菜', '生活']
		});
		expect(pack.title).toBe('阳台种菜');
		expect(pack.text).toContain('阳台种菜');
		expect(pack.text).toContain('一块托盘也能长出夏天。');
		expect(pack.text).toContain('#种菜');
		expect(pack.text).toContain('#生活');
		expect(pack.text).not.toMatch(/https?:\/\/(www\.)?(xiaohongshu|xhslink)/i);
	});

	it('formats 微信 and 公众号 as article text without hashtags', () => {
		const wechat = formatSharePack('微信', {
			title: '午睡十分钟',
			body: '把午后还给自己。'
		});
		expect(wechat.text).toContain('午睡十分钟');
		expect(wechat.text).toContain('把午后还给自己。');
		expect(wechat.text).not.toContain('#');
		const mp = formatSharePack('公众号', {
			title: '午睡十分钟',
			body: '把午后还给自己。'
		});
		expect(mp.text.startsWith('# 午睡十分钟')).toBe(true);
	});

	it('formats 抖音 as a short caption with hashtags', () => {
		const pack = formatSharePack('抖音', {
			title: '通勤英语',
			body: '一站路，一句新表达。',
			tags: ['英语']
		});
		expect(pack.text).toContain('一站路，一句新表达。');
		expect(pack.text).toContain('#英语');
	});
});

describe('shareViaOfficial', () => {
	it('uses the Web Share API when it is present', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		const writeText = vi.fn();
		const result = await shareViaOfficial(
			{ title: '阳台种菜', text: '一块托盘也能长出夏天。' },
			{ share, clipboard: { writeText } }
		);
		expect(result.method).toBe('web-share');
		expect(share).toHaveBeenCalledWith({
			title: '阳台种菜',
			text: '一块托盘也能长出夏天。'
		});
		expect(writeText).not.toHaveBeenCalled();
	});

	it('falls back to clipboard when Web Share is missing', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const result = await shareViaOfficial(
			{ title: '阳台种菜', text: '一块托盘也能长出夏天。' },
			{ clipboard: { writeText } }
		);
		expect(result.method).toBe('clipboard');
		expect(writeText).toHaveBeenCalledWith('一块托盘也能长出夏天。');
	});

	it('treats a user-abort as cancelled and does not copy', async () => {
		const err = new Error('Share canceled');
		err.name = 'AbortError';
		const writeText = vi.fn();
		const result = await shareViaOfficial(
			{ title: '阳台种菜', text: '一块托盘也能长出夏天。' },
			{ share: vi.fn().mockRejectedValue(err), clipboard: { writeText } }
		);
		expect(result.method).toBe('cancelled');
		expect(writeText).not.toHaveBeenCalled();
	});
});
