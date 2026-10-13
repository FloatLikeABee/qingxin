export interface MoodEmoji {
	glyph: string;
	score: number;
	label: string;
}

export const MOOD_EMOJIS: MoodEmoji[] = [
	{ glyph: '😄', score: 5, label: '很好' },
	{ glyph: '🙂', score: 4, label: '还不错' },
	{ glyph: '😐', score: 3, label: '平静' },
	{ glyph: '😔', score: 2, label: '低落' },
	{ glyph: '😢', score: 1, label: '很难过' },
	{ glyph: '😡', score: 2, label: '生气' },
	{ glyph: '😰', score: 2, label: '焦虑' },
	{ glyph: '🥰', score: 5, label: '被爱' }
];

export const MOOD_TAGS = ['工作', '家庭', '睡眠', '健康', '社交', '学习', '天气', '运动', '独处', '压力'] as const;

export type MoodTag = (typeof MOOD_TAGS)[number];

export interface SoundPreset {
	id: 'rain' | 'waves' | 'fan' | 'fire' | 'white';
	name: string;
}

export const SOUND_PRESETS: SoundPreset[] = [
	{ id: 'rain', name: '雨声' },
	{ id: 'waves', name: '海浪' },
	{ id: 'fan', name: '风扇' },
	{ id: 'fire', name: '篝火' },
	{ id: 'white', name: '白噪音' }
];

export interface BedtimeStory {
	id: string;
	title: string;
	body: string;
}

export const BEDTIME_STORIES: BedtimeStory[] = [
	{
		id: 'lantern',
		title: '河岸的灯',
		body: '有人在河岸挂了一盏很小的灯。风来的时候，灯只是轻轻晃，并不急着证明自己有多亮。你也可以这样：把今天放下，让光自己停在附近。'
	},
	{
		id: 'cloud',
		title: '云停了一会儿',
		body: '傍晚的云走得很慢，像是把一天的声音都裹进棉花里。窗开一条缝就够了。呼吸进去，再慢慢送出去，故事就可以在这里结束。'
	}
];
