import { type Browser, type ElementHandle, type Page } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database/database.ts';
import { AdditinalOfferInformation, type Offer, Profile } from './definitions.d.ts';

export default class Degewo extends BaseBot {
	constructor(db: DataBase) {
		const url =
			'https://immosuche.degewo.de/de/search?size=10&page=1&property_type_id=1&categories%5B%5D=1&lat=&lon=&area=&address%5Bstreet%5D=&address%5Bcity%5D=&address%5Bzipcode%5D=&address%5Bdistrict%5D=&district=33%2C+46%2C+3%2C+28%2C+29%2C+71%2C+60&property_number=&price_switch=true&price_radio=null&price_from=&price_to=&qm_radio=null&qm_from=&qm_to=&rooms_radio=custom&rooms_from=1&rooms_to=4&wbs_required=&order=rent_total_without_vat_asc';
		const companyIdentifier = 'Degewo';
		super(db, url, companyIdentifier);
	}

	async visitOfferLink(page: Page, offerLink: string): Promise<void> {
		await page.goto(offerLink);
	}

	async getAllOffersFromPage(page: Page): Promise<Offer[]> {
		const offerElements = (await page.$$(
			'article.article-list__item.article-list__item--immosearch',
		)) as ElementHandle<HTMLElement>[];

		const offers: Offer[] = [];

		for (let i = 0; i < offerElements.length; i++) {
			const offerElement = offerElements[i];

			const mainPropertyList = (await offerElement.$('ul.article__properties')) as ElementHandle<
				HTMLUListElement
			>;

			const properties = await mainPropertyList.$$eval(
				'span.text',
				(elements: HTMLSpanElement[]) => elements.map((el) => el.textContent),
			);

			const rooms = properties[0] !== null ? properties[0][0] : null;
			const size = properties[1] !== null ? properties[1] : null;
			const wbs = properties[3] === 'mit WBS' ? true : false;

			const rent = await offerElement.$eval(
				'span.price',
				(el: HTMLSpanElement) => el.textContent,
			);

			const address = await offerElement.$eval(
				'span.article__meta',
				(el: HTMLSpanElement) => el.textContent,
			);
			const match = address?.match(/^(.*)(?: \| )(.*)$/) || [];
			const street = match[1] || null;
			const district = match[2] || null;

			const url = await offerElement.$eval('a', (el: HTMLLinkElement) => el.href);

			const offer: Offer = {
				rent,
				size,
				rooms: Number(rooms),
				url,
				wbs,
				street,
				district,
			};

			offers.push(offer);
		}

		return offers;
	}

	async fillForm(page: Page, profile: Profile): Promise<void> {
		await page.waitForSelector('a[href="#kontakt"]');
		await page.click('a[href="#kontakt"]');

		await page.waitForSelector('section#kontakt iframe');
		const iframeEl = await page.$('section#kontakt iframe');

		const frame = await iframeEl?.contentFrame();

		if (frame == null) return;

		await frame.waitForSelector('form.application-form');
		await frame.waitForSelector('nz-select.ng-tns-c3-0.ant-select');

		const selectBtn = await frame.$('nz-select.ng-tns-c3-0.ant-select');
		await selectBtn?.evaluate((el) => el.click());


		await frame.waitForXPath(`//li[contains(text(), ${profile.gender})]`);
		const selectEl = await frame.$x(`//li[contains(text(), ${profile.gender})]`);
		await selectEl.at(0)?.evaluate((el) => el.click());

		await frame.type('input#firstName', profile.surname);
		await frame.type('input#lastName', profile.name);
		await frame.type('input#email', profile.email);
		await frame.type('input#phone-number', profile.phone);
	}

	async submitForm(page: Page): Promise<void> {
		const iframeEl = await page.$('section#kontakt iframe');
		const frame = await iframeEl?.contentFrame();

		if (frame == null) return;

		await frame.$eval(
			'form.application-form.ant-form.ant-form-vertical',
			(form: HTMLFormElement) => form.submit(),
		);
	}

	async gatherAdditionalOfferInformation(page: Page): Promise<AdditinalOfferInformation> {
		const address = await page.$eval(
			'header.article__header>span.expose__meta',
			(el: HTMLSpanElement) => el.textContent,
		);

		const match = address?.match(/^(?:.*\| )(\d*)(?:.*)$/) || [];
		const zip = match[1] || null;

		return { zip };
	}

	async applyForOffer(page: Page, profile: Profile): Promise<boolean> {
		await this.fillForm(page, profile);
		await this.submitForm(page);
		return true;
	}
}
