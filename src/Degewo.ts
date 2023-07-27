import { type ElementHandle, type Page } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database/database.ts';
import { AdditinalOfferInformation, type Offer, Profile } from './definitions.d.ts';
import { createScreenhot } from './utils.ts';

export default class Degewo extends BaseBot {
	constructor(page: Page, db: DataBase) {
		const url =
			'https://immosuche.degewo.de/de/search?size=10&page=1&property_type_id=1&categories%5B%5D=1&lat=&lon=&area=&address%5Bstreet%5D=&address%5Bcity%5D=&address%5Bzipcode%5D=&address%5Bdistrict%5D=&district=33%2C+46%2C+3%2C+28%2C+29%2C+71%2C+60&property_number=&price_switch=true&price_radio=null&price_from=&price_to=&qm_radio=null&qm_from=&qm_to=&rooms_radio=custom&rooms_from=1&rooms_to=4&wbs_required=&order=rent_total_without_vat_asc';
		const companyIdentifier = 'Degewo';
		super(page, db, url, companyIdentifier);
	}

	async visitOfferLink(offerLink: string): Promise<void> {
		// if (Deno.env.get('TEST') === 'true') await this.page.goto(offerLink);
		// else await this.page.goto(`https://immosuche.degewo.de${offerLink}`);

		await this.page.goto(offerLink);
	}

	async getAllOffersFromPage(): Promise<Offer[]> {
		const offerElements = (await this.page.$$(
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

	async fillForm(profile: Profile): Promise<void> {
		await this.page.waitForSelector('a[href="#kontakt"]');
		await this.page.click('a[href="#kontakt"]');

		await this.page.waitForSelector('section#kontakt iframe');
		const iframeEl = await this.page.$('section#kontakt iframe');
		const frame = await iframeEl?.contentFrame();

		if (frame == null) return;

		await frame.waitForSelector('nz-select.ng-tns-c3-0.ant-select');

		await frame.click('nz-select.ng-tns-c3-0.ant-select');
		const selectEl = await frame.$x(`//a[contains(text(), ${profile.gender})]`);
		await selectEl[0].click();

		await frame.type('input#firstName', profile.surname);
		await frame.type('input#lastName', profile.name);
		await frame.type('input#email', profile.email);
		await frame.type('input#phone-number', profile.phone);
	}

	async submitForm(): Promise<void> {
		const iframeEl = await this.page.$('section#kontakt iframe');
		const frame = await iframeEl?.contentFrame();

		if (frame == null) return;

		await frame.$eval(
			'form.application-form.ant-form.ant-form-vertical',
			(form: HTMLFormElement) => form.submit(),
		);
	}

	async gatherAdditionalOfferInformation(): Promise<AdditinalOfferInformation> {
		const address = await this.page.$eval(
			'header.article__header>span.expose__meta',
			(el: HTMLSpanElement) => el.textContent,
		);

		const match = address?.match(/^(?:.*\| )(\d*)(?:.*)$/) || [];
		const zip = match[1] || null;

		return { zip };
	}

	async applyForOffer(profile: Profile): Promise<boolean> {
		await this.fillForm(profile);
		await this.submitForm();
		return true;
	}
}
