import { puppeteer, type Browser, type Page, type LaunchOptions } from '../deps.ts';

import DataBase from './database.ts';
import WBM from './WBM.ts';
import searchConfig from '../search-config.json' assert { type: 'json' };

class FlatsBot {
	private config: typeof searchConfig;
	private isProd: boolean;
	private db: DataBase;
	private launchOptions: LaunchOptions = {};

	private browser?: Browser;
	private page?: Page;

	private wbmBot?: WBM;

	constructor(config: typeof searchConfig) {
		this.config = config;
		this.isProd = Deno.env.get('PRODUCTION') === 'true';
		this.db = new DataBase();

		if (this.isProd) this.launchOptions = {
			executablePath: '/usr/bin/google-chrome',
		}
	}

	async init(): Promise<void> {
		await this.db.init();
		this.browser = await puppeteer.launch(this.launchOptions);
	}

	async run(): Promise<void> {
		await this.init();
		this.page = await this.browser?.newPage();

		if (this.page == null) return;

		this.wbmBot = new WBM(this.page, this.config, this.db);
		await this.wbmBot.run();

		await this.close();
	}

	async close(): Promise<void> {
		await this.page?.close();
		await this.browser?.close();
		await this.db.close();
	}
}

const bot = new FlatsBot(searchConfig);

await bot.run();

setInterval(() => bot.run(), 5 * 60 * 1000);
