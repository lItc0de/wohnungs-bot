import { puppeteer } from '../deps.ts';
import searchConfig from '../search-config.json' assert { type: 'json' };
import type DataBase from './database.ts';
import { type Offer } from './definitions.d.ts';
import { createScreenhot } from './utils.ts';

export default class WBM {
	static url = 'https://www.wbm.de/wohnungen-berlin/angebote/';
	// static url = 'http://localhost:3000';
	static wbsXSelect = '//*[contains(text(), "WBS erforderlich:")]/..';
	static wbsTestRegexp = /WBS erforderlich:.*Nein/i;
	static companyIdentifier = 'WBM';

	private page: puppeteer.Page;
	private config: typeof searchConfig.searches[0];
	private db: DataBase;

	constructor(page: puppeteer.Page, config: typeof searchConfig.searches[0], db: DataBase) {
		this.page = page;
		this.config = config;
		this.db = db;
	}

	async visitMainPage(): Promise<void> {
		await this.page.goto(WBM.url);
	}

	async visitOfferLink(offerLink: string): Promise<void> {
		await this.page.goto(offerLink);
	}

	async getAllOffers(): Promise<Offer[]> {
		const offerElements =
			(await this.page.$$('.row .openimmo-search-list-item')) as puppeteer.ElementHandle<
				HTMLDivElement
			>[];

		const offers: Offer[] = [];

		for (let i = 0; i < offerElements.length; i++) {
			const offerElement = offerElements[i];

			const mainPropertyList =
				(await offerElement.$('ul.main-property-list')) as puppeteer.ElementHandle<
					HTMLUListElement
				>;

			const rent = await mainPropertyList.$eval(
				'div.main-property-rent.main-property-value',
				(el: HTMLDivElement) => el.textContent,
			);
			const size = await mainPropertyList.$eval(
				'div.main-property-size.main-property-value',
				(el: HTMLDivElement) => el.textContent,
			);
			const rooms = await mainPropertyList.$eval(
				'div.main-property-rooms.main-property-value',
				(el: HTMLDivElement) => el.textContent,
			);

			const url = await offerElement.$eval('a[title="Details"]', (el: HTMLLinkElement) => el.href);

			const offer = {
				rent,
				size,
				rooms: Number(rooms),
				url,
			};

			offers.push(offer);
		}

		return offers;
	}

	getRelevantOffers(timestamp: number): { id: string; url: string }[] {
		return this.db.getRelevantOffers(timestamp)
			// check number of rooms
			.filter((offer) => offer[2] >= 2 || Number.isNaN(offer[2]))
			// get links
			.map((offer) => ({ id: offer[0], url: offer[1] }));
	}

	async checkNoWbs(id: string): Promise<boolean> {
		const wbsTextEl = await this.page.$x(WBM.wbsXSelect);
		const wbsText = await this.page.evaluate((el) => el.textContent, wbsTextEl[0]);

		const noWbs = WBM.wbsTestRegexp.test(wbsText);
		this.db.updateOffer(id, !noWbs);
		return noWbs;
	}

	async fillForm(): Promise<void> {
		await this.page.select('select#powermail_field_anrede', this.config.gender);

		await this.page.type('input#powermail_field_name', this.config.name);
		await this.page.type('input#powermail_field_vorname', this.config.surname);
		await this.page.type('input#powermail_field_strasse', this.config.street);
		await this.page.type('input#powermail_field_plz', this.config.plz);
		await this.page.type('input#powermail_field_ort', this.config.city);
		await this.page.type('input#powermail_field_e_mail', this.config.email);
		await this.page.type('input#powermail_field_telefon', this.config.phone);

		await this.page.waitForSelector('input#powermail_field_datenschutzhinweis_1');
		await this.page.evaluate(() => {
			const input = document.querySelector('input#powermail_field_datenschutzhinweis_1');
			input?.parentElement?.click();
		});
	}

	async submitForm(): Promise<void> {
		await this.page.click('button[type="submit"]');
	}

	storeOffers(offers: Offer[]): void {
		offers.forEach((offer) => {
			this.db.createOffer(WBM.companyIdentifier, offer);
		});
	}

	async run(): Promise<void> {
		const currentTimestamp = Date.now();

		await this.visitMainPage();

		const offers = await this.getAllOffers();
		this.storeOffers(offers);

		const relevantOffers = this.getRelevantOffers(currentTimestamp);

		console.log(relevantOffers);

		for (let i = 0; i < relevantOffers.length; i++) {
			const offer = relevantOffers[i];
			console.log('lol:', offer);

			await this.visitOfferLink(offer.url);

			if (!this.checkNoWbs(offer.id)) return;

			await this.fillForm();

			await createScreenhot(this.page);
			// await this.submitForm();
		}
	}
}
