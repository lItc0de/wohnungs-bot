import {
	puppeteer,
	type Browser,
	type LaunchOptions,
	type Page,
} from '../deps.ts';

import DataBase from './database/database.ts';
import WBM from './WBM.ts';
import Degewo from './Degewo.ts';

class FlatsBot {
	private isProd: boolean;
	private db: DataBase;
	private launchOptions: LaunchOptions = {};

	private browser?: Browser;
	private page?: Page;

	private wbmBot?: WBM;
	private degewoBot?: Degewo;

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

	async run(): Promise<void> {
		console.log('🚀 Start');

		await this.init();
		this.page = await this.browser?.newPage();

		if (this.page == null) return;

		// WBM
		console.log('🔎 WBM search');
		this.wbmBot = new WBM(this.page, this.db);
		await this.wbmBot.run();

		// Degewo
		console.log('🔎 Degewo search');
		this.degewoBot = new Degewo(this.page, this.db);
		await this.degewoBot.run();

		await this.close();

		console.log('✅ Finished');
	}

	async close(): Promise<void> {
		await this.page?.close();
		await this.browser?.close();
		await this.db.close();
	}
}

const bot = new FlatsBot();

await bot.run();

setInterval(() => bot.run(), 1 * 60 * 1000);
