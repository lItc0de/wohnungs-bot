import { type ElementHandle, type Page } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database/database.ts';
import { AdditinalOfferInformation, type Offer, Profile } from './definitions.d.ts';

export default class WBM extends BaseBot {
	constructor(page: Page, db: DataBase) {
		const url = 'https://www.wbm.de/wohnungen-berlin/angebote/';
		const companyIdentifier = 'WBM';
		super(page, db, url, companyIdentifier);
	}

	async getAllOffersFromPage(): Promise<Offer[]> {
		const offerElements = (await this.page.$$('.row .openimmo-search-list-item')) as ElementHandle<
			HTMLDivElement
		>[];

		const offers: Offer[] = [];

		for (let i = 0; i < offerElements.length; i++) {
			const offerElement = offerElements[i];

			const mainPropertyList = (await offerElement.$('ul.main-property-list')) as ElementHandle<
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

			const address = await offerElement.$eval(
				'div.address',
				(el: HTMLDivElement) => el.textContent,
			);
			const match = address?.match(/^(.*)(?:, ?)(\d*)(?:.*)$/) || [];
			const street = match[1] || null;
			const zip = match[2] || null;

			const district = await offerElement.$eval('div.area', (el: HTMLDivElement) => el.textContent);

			const url = await offerElement.$eval('a[title="Details"]', (el: HTMLLinkElement) => el.href);

			const offer: Offer = {
				rent,
				size,
				rooms: Number(rooms),
				url,
				street,
				zip,
				district,
			};

			offers.push(offer);
		}

		return offers;
	}

	async gatherAdditionalOfferInformation(): Promise<AdditinalOfferInformation> {
		const exposeUrl = await this.page.$eval(
			'a.openimmo-detail__intro-expose-button.btn.download',
			(el: HTMLLinkElement) => el.href,
		);
		const additionalOfferInformation = {
			wbs: !(await this.checkNoWbs()),
			exposeUrl,
		};

		return additionalOfferInformation;
	}

	async checkNoWbs(): Promise<boolean> {
		const wbsXSelect = '//*[contains(text(), "WBS erforderlich:")]/..';
		const wbsTestRegexp = /WBS erforderlich:.*Nein/i;

		const wbsTextEl = await this.page.$x(wbsXSelect);
		const wbsText = await this.page.evaluate((el) => el.textContent, wbsTextEl[0]);

		const noWbs = wbsTestRegexp.test(wbsText);
		return noWbs;
	}

	async fillForm(profile: Profile): Promise<void> {
		await this.page.select('select#powermail_field_anrede', profile.gender);

		await this.page.type('input#powermail_field_name', profile.name);
		await this.page.type('input#powermail_field_vorname', profile.surname);
		await this.page.type('input#powermail_field_strasse', profile.street);
		await this.page.type('input#powermail_field_plz', profile.plz);
		await this.page.type('input#powermail_field_ort', profile.city);
		await this.page.type('input#powermail_field_e_mail', profile.email);
		await this.page.type('input#powermail_field_telefon', profile.phone);

		await this.page.waitForSelector('input#powermail_field_datenschutzhinweis_1');
		await this.page.evaluate(() => {
			const input = document.getElementById(
				'powermail_field_datenschutzhinweis_1',
			) as HTMLInputElement;
			input.click();
		});
	}

	async submitForm(): Promise<void> {
		await this.page.click('button[type="submit"]');
	}

	async applyForOffer(profile: Profile): Promise<boolean> {
		await this.fillForm(profile);
		await this.submitForm();
		return true;
	}
}
