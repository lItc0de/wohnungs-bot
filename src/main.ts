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
	private pageWBM?: Page;
	private pageDegewo?: Page;

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
		this.pageWBM = await this.browser?.newPage();
		this.pageDegewo = await this.browser?.newPage();

		if (this.pageWBM == null || this.pageDegewo == null) return;

		// WBM
		console.log('🔎 WBM search');
		this.wbmBot = new WBM(this.pageWBM, this.db);
		await this.wbmBot.run();

		// Degewo
		console.log('🔎 Degewo search');
		this.degewoBot = new Degewo(this.pageDegewo, this.db);
		await this.degewoBot.run();

		await this.close();

		console.log('✅ Finished');
	}

	async close(): Promise<void> {
		await this.pageWBM?.close();
		await this.pageDegewo?.close();
		await this.browser?.close();
		await this.db.close();
	}
}

const bot = new FlatsBot();

await bot.run();

setInterval(() => bot.run(), 1 * 60 * 1000);
