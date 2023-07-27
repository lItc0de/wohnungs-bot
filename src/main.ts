import { type Browser, Cron, type LaunchOptions, type Page, puppeteer } from '../deps.ts';

import DataBase from './database/database.ts';
import WBM from './WBM.ts';
import Degewo from './Degewo.ts';

class FlatsBot {
	private isProd: boolean;
	private db: DataBase;
	private launchOptions: LaunchOptions = {};

	private browser?: Browser;
	private pageWBM?: Page;
	private pageDegewo?: Page;

	private wbmBot?: WBM;
	private degewoBot?: Degewo;

	private wbmTask?: Cron;
	private degewoTask?: Cron;

	constructor() {
		this.isProd = Deno.env.get('PRODUCTION') === 'true';
		this.db = new DataBase();

		if (this.isProd) {
			this.launchOptions = {
				executablePath: '/usr/bin/google-chrome',
			};
		}
	}

	async init(): Promise<void> {
		await this.db.init();
		this.browser = await puppeteer.launch(this.launchOptions);
	}

	private async runWBM(): Promise<void> {
		this.pageWBM = await this.browser?.newPage();
		if (this.pageWBM == null) return;

		this.wbmBot = new WBM(this.pageWBM, this.db);

		// run every 30 secs
		this.wbmTask = new Cron('*/30 * 5-21 * * *', { timezone: 'Europe/Berlin' }, async () => {
			console.log('WBM: 🔎 search');
			await this.wbmBot?.run();
			console.log('WBM: ✅ Finished');
		});
	}

	private async runDegewo(): Promise<void> {
		this.pageDegewo = await this.browser?.newPage();
		if (this.pageDegewo == null) return;

		this.degewoBot = new Degewo(this.pageDegewo, this.db);
		// await this.degewoBot.run();

		// run every 5 mins
		this.degewoTask = new Cron('0 */5 5-21 * * *', { timezone: 'Europe/Berlin' }, async () => {
			console.log('Degewo: 🔎 search');
			await this.degewoBot?.run();
			console.log('Degewo: ✅ Finished');
		});
	}

	async run(): Promise<void> {
		console.log('🚀 Start');
		await this.init();
		this.runWBM();
		// this.runDegewo();
	}

	async close(): Promise<void> {
		this.wbmTask?.stop();
		this.degewoTask?.stop();

		await this.pageWBM?.close();
		await this.pageDegewo?.close();

		await this.browser?.close();
		await this.db.close();
	}
}

const bot = new FlatsBot();

Deno.addSignalListener('SIGINT', () => {
	console.log('interrupted!');
	bot.close();
	Deno.exit();
});

bot.run();
