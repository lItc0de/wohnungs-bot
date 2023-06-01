import { path, puppeteer } from '../deps.ts';

export const createScreenhot = async (page: puppeteer.Page): Promise<void> => {
	await page.screenshot({
		path: path.join('screenshots', `${Date.now()}.jpeg`),
		type: 'jpeg',
		fullPage: true,
	});
};

export const onlyUnique = (value: string, index: number, array: string[]) => {
	return array.indexOf(value) === index;
}
