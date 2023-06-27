import { type ElementHandle, type Page } from '../deps.ts';
import searchConfig from '../search-config.json' assert { type: 'json' };
import BaseBot from './BaseBot.ts';
import type DataBase from './database.ts';
import { type Info, type Offer } from './definitions.d.ts';
import { createScreenhot } from './utils.ts';

export default class Degewo extends BaseBot {
	constructor(page: Page, config: typeof searchConfig, db: DataBase) {
		const url =
			'https://immosuche.degewo.de/de/search?size=10&page=1&property_type_id=1&categories%5B%5D=1&lat=&lon=&area=&address%5Bstreet%5D=&address%5Bcity%5D=&address%5Bzipcode%5D=&address%5Bdistrict%5D=&district=33%2C+46%2C+3%2C+28%2C+29%2C+71%2C+60&property_number=&price_switch=true&price_radio=null&price_from=&price_to=&qm_radio=null&qm_from=&qm_to=&rooms_radio=custom&rooms_from=2&rooms_to=4&wbs_required=&order=rent_total_without_vat_asc';
		const companyIdentifier = 'Degewo';
		super(page, config, db, url, companyIdentifier);
	}

	async visitOfferLink(offerLink: string): Promise<void> {
		if (Deno.env.get('TEST') === 'true') await this.page.goto(offerLink);
		else await this.page.goto(`https://immosuche.degewo.de${offerLink}`);
	}

	async getAllOffers(): Promise<Offer[]> {
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

			const url = await offerElement.$eval('a', (el: HTMLLinkElement) => el.href);

			const offer = {
				rent,
				size,
				rooms: Number(rooms),
				url,
				wbs,
			};

			offers.push(offer);
		}

		return offers;
	}

	async fillForm(info: Info): Promise<void> {
		await this.page.waitForSelector('a[href="#kontakt"]');
		await this.page.click('a[href="#kontakt"]');

		await createScreenhot(this.page);

		await this.page.waitForSelector('div.ant-select-selection__placeholder.ng-tns-c5-1.ng-star-inserted');

		await this.page.click('div.ant-select-selection__placeholder.ng-tns-c5-1.ng-star-inserted');
		const selectEl = await this.page.$x(`//a[contains(text(), ${info.gender})]`);
		await selectEl[0].click();

		await this.page.type('input#firstName', info.surname);
		await this.page.type('input#lastName', info.name);
		await this.page.type('input#email', info.email);
		await this.page.type('input#phone-number', info.phone);
	}

	async submitForm(): Promise<void> {
		await this.page.$eval(
			'form.application-form.ant-form.ant-form-vertical',
			(form: HTMLFormElement) => form.submit(),
		);
	}

	async applyForOffers(offers: { id: string; url: string }[], info: Info): Promise<void> {
		for (let i = 0; i < offers.length; i++) {
			const offer = offers[i];

			await this.visitOfferLink(offer.url);

			await this.fillForm(info);

			await this.submitForm();

			await this.updateApplied(offer.id);
		}
	}
}
