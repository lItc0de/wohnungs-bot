import { type Page, type ElementHandle } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database.ts';
import { type Offer, type Search, type Config, type FlatsRow, type Info } from './definitions.d.ts';

export default class WBM extends BaseBot {
	constructor(page: Page, config: Config, db: DataBase) {
		const url = 'https://www.wbm.de/wohnungen-berlin/angebote/';
		const companyIdentifier = 'WBM';
		super(page, config, db, url, companyIdentifier);
	}

	async getAllOffers(): Promise<Offer[]> {
		const offerElements =
			(await this.page.$$('.row .openimmo-search-list-item')) as ElementHandle<
				HTMLDivElement
			>[];

		const offers: Offer[] = [];

		for (let i = 0; i < offerElements.length; i++) {
			const offerElement = offerElements[i];

			const mainPropertyList =
				(await offerElement.$('ul.main-property-list')) as ElementHandle<
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

	async checkNoWbs(id: string): Promise<boolean> {
		const wbsXSelect = '//*[contains(text(), "WBS erforderlich:")]/..';
		const wbsTestRegexp = /WBS erforderlich:.*Nein/i;

		const wbsTextEl = await this.page.$x(wbsXSelect);
		const wbsText = await this.page.evaluate((el) => el.textContent, wbsTextEl[0]);

		const noWbs = wbsTestRegexp.test(wbsText);
		this.db.updateOffer(id, !noWbs);
		return noWbs;
	}

	async fillForm(info: Info): Promise<void> {
		await this.page.select('select#powermail_field_anrede', info.gender);

		await this.page.type('input#powermail_field_name', info.name);
		await this.page.type('input#powermail_field_vorname', info.surname);
		await this.page.type('input#powermail_field_strasse', info.street);
		await this.page.type('input#powermail_field_plz', info.plz);
		await this.page.type('input#powermail_field_ort', info.city);
		await this.page.type('input#powermail_field_e_mail', info.email);
		await this.page.type('input#powermail_field_telefon', info.phone);

		await this.page.waitForSelector('input#powermail_field_datenschutzhinweis_1');
		await this.page.evaluate(() => {
			const input = document.querySelector('input#powermail_field_datenschutzhinweis_1');
			input?.parentElement?.click();
		});
	}

	async submitForm(): Promise<void> {
		await this.page.click('button[type="submit"]');
	}

	async applyForOffers(offers: { id: string; url: string }[], info: Info): Promise<void> {
		for (let i = 0; i < offers.length; i++) {
			const offer = offers[i];

			await this.visitOfferLink(offer.url);

			if (!this.checkNoWbs(offer.id)) return;

			await this.fillForm(info);

			await this.submitForm();
		}
	}
}
