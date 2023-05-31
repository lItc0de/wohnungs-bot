import { join } from 'https://deno.land/std@0.177.1/path/mod.ts';
import { type Page } from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';

export const createScreenhot = async (page: Page): Promise<void> => {
	await page.screenshot({
		path: join('screenshots', `${Date.now()}.jpeg`),
		type: 'jpeg',
		fullPage: true,
	});
};

export const onlyUnique = (value: string, index: number, array: string[]) => {
	return array.indexOf(value) === index;
}
