// import puppeteer from 'npm:puppeteer@^20';
import puppeteer, { type Browser, type Page } from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';

import DataBase from './database.ts';
import WBM from './WBM.ts';
import searchConfig from '../search-config.json' assert { type: 'json' };

class FlatsBot {
	private browser?: Browser;
	private page?: Page;
	private wbmBot?: WBM;
	private db?: DataBase;

	async init(): Promise<void> {
		this.browser = await puppeteer.launch();
		this.page = await this.browser.newPage();
		this.db = new DataBase();

		this.wbmBot = new WBM(this.page, searchConfig.searches[0], this.db);
	}

	async run(): Promise<void> {
		await this.wbmBot?.run();
	}

	async close(): Promise<void> {
		await this.browser?.close();
	}
}

const run = async () => {
	const bot = new FlatsBot();

	await bot.init();
	await bot.run();
	await bot.close();

  // await loop(() => new Promise(() => resolve));
};

run();

// setInterval(run, 5 * 60 * 1000);
