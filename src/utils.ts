import { path, type Page } from '../deps.ts';

export const createScreenhot = async (page: Page): Promise<void> => {
	await page.screenshot({
		path: path.join('screenshots', `${Date.now()}.jpeg`),
		type: 'jpeg',
		fullPage: true,
	});
};

export const onlyUnique = (value: string, index: number, array: string[]) => {
	return array.indexOf(value) === index;
}

export const logger = (...data: any[]) => {
	const isProd = Deno.env.get('PRODUCTION') === 'true';
	const isTest = Deno.env.get('TEST') === 'true';
	if (isProd || isTest) return;

	console.log(...data);
}
