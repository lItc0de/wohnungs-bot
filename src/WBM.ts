import { type ElementHandle, type Page } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database/database.ts';
import { AdditinalOfferInformation, type Offer, Profile } from './definitions.d.ts';

export default class WBM extends BaseBot {
	constructor(db: DataBase) {
		const url = 'https://www.wbm.de/wohnungen-berlin/angebote/';
		const companyIdentifier = 'WBM';
		super(db, url, companyIdentifier);
	}

	protected async getAllOffersFromPage(page: Page): Promise<Offer[]> {
		const offerElements = (await page.$$('.row .openimmo-search-list-item')) as ElementHandle<
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

	protected async gatherAdditionalOfferInformation(page: Page): Promise<AdditinalOfferInformation> {
		const exposeUrl = await page.$eval(
			'a.openimmo-detail__intro-expose-button.btn.download',
			(el: HTMLLinkElement) => el.href,
		);
		const additionalOfferInformation = {
			wbs: !(await this.checkNoWbs(page)),
			exposeUrl,
		};

		return additionalOfferInformation;
	}

	protected async checkNoWbs(page: Page): Promise<boolean> {
		if (page == null) return false;

		const wbsXSelect = '//*[contains(text(), "WBS erforderlich:")]/..';
		const wbsTestRegexp = /WBS erforderlich:.*Nein/i;

		const wbsTextEl = await page.$x(wbsXSelect);
		const wbsText = await page.evaluate((el) => el.textContent, wbsTextEl[0]);

		const noWbs = wbsTestRegexp.test(wbsText);
		return noWbs;
	}

	private async fillForm(page: Page, profile: Profile): Promise<void> {
		if (page == null) return;

		await page.select('select#powermail_field_anrede', profile.gender);

		await page.type('input#powermail_field_name', profile.name);
		await page.type('input#powermail_field_vorname', profile.surname);
		await page.type('input#powermail_field_strasse', profile.street);
		await page.type('input#powermail_field_plz', profile.plz);
		await page.type('input#powermail_field_ort', profile.city);
		await page.type('input#powermail_field_e_mail', profile.email);
		await page.type('input#powermail_field_telefon', profile.phone);

		await page.waitForSelector('input#powermail_field_datenschutzhinweis_1');
		await page.evaluate(() => {
			const input = document.getElementById(
				'powermail_field_datenschutzhinweis_1',
			) as HTMLInputElement;
			input.click();
		});
	}

	private async submitForm(page: Page): Promise<void> {
		if (page == null) return;
		await page.click('button[type="submit"]');
	}

	protected async applyForOffer(page: Page, profile: Profile): Promise<boolean> {
		await this.fillForm(page, profile);
		await this.submitForm(page);
		return true;
	}
}
