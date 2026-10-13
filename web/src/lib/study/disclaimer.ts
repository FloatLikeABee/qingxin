export const DISCLAIMER = '本模块为学习习惯记录工具，不构成教学辅导或心理咨询。';

export const TARGET_DAYS = [7, 14, 21] as const;
export type TargetDays = (typeof TARGET_DAYS)[number];
