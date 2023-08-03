import { type Browser, Cron, type LaunchOptions, type Page, puppeteer } from '../deps.ts';

import DataBase from './database/database.ts';
import WBM from './WBM.ts';
import Degewo from './Degewo.ts';
import { logger } from './utils.ts';

class FlatsBot {
	private db: DataBase;

	private wbmBot?: WBM;
	private degewoBot?: Degewo;

	private wbmTask?: Cron;
	private degewoTask?: Cron;

	constructor() {
		this.db = new DataBase();
	}

	async init(): Promise<void> {
		await this.db.init();
	}

	private runWBM() {
		this.wbmBot = new WBM(this.db);

		// run every 30 secs
		this.wbmTask = new Cron('*/30 * 5-21 * * *', { timezone: 'Europe/Berlin' }, async () => {
			logger('WBM: 🔎 search');
			await this.wbmBot?.run();
			logger('WBM: ✅ Finished');
		});
	}

	private runDegewo() {
		this.degewoBot = new Degewo(this.db);
		// await this.degewoBot.run();

		// run every 5 mins
		this.degewoTask = new Cron('0 */5 5-21 * * *', { timezone: 'Europe/Berlin' }, async () => {
			logger('Degewo: 🔎 search');
			await this.degewoBot?.run();
			logger('Degewo: ✅ Finished');
		});
	}

	async run(): Promise<void> {
		logger('🚀 Start');
		await this.init();
		this.runWBM();
		// this.runDegewo();
	}

	async close(): Promise<void> {
		this.wbmTask?.stop();
		this.degewoTask?.stop();

		await this.db.close();
	}
}

const bot = new FlatsBot();

Deno.addSignalListener('SIGINT', () => {
	logger('interrupted!');
	bot.close();
	Deno.exit();
});

bot.run();
