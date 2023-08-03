import { type ElementHandle, type Page } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database/database.ts';
import { type Offer, Profile } from './definitions.d.ts';

const url =
	'https://www.howoge.de/wohnungen-gewerbe/wohnungssuche.html?tx_howsite_json_list%5Bpage%5D=1&tx_howsite_json_list%5Blimit%5D=12&tx_howsite_json_list%5Blang%5D=&tx_howsite_json_list%5Bkiez%5D%5B%5D=Friedrichshain-Kreuzberg&tx_howsite_json_list%5Bkiez%5D%5B%5D=Mitte&tx_howsite_json_list%5Bkiez%5D%5B%5D=Charlottenburg-Wilmersdorf&tx_howsite_json_list%5Bkiez%5D%5B%5D=Neuk%C3%B6lln&tx_howsite_json_list%5Bkiez%5D%5B%5D=Tempelhof-Sch%C3%B6neberg&tx_howsite_json_list%5Brooms%5D=';

export default class Howoge extends BaseBot {
	constructor(db: DataBase) {
		const companyIdentifier = 'Howoge';
		super(db, url, companyIdentifier);
	}

	async getAllOffersFromPage(page: Page): Promise<Offer[]> {
		const offerElements = (await page.$$('div.flat-single-grid-item')) as ElementHandle<
			HTMLDivElement
		>[];

		const offers: Offer[] = [];

		for (let i = 0; i < offerElements.length; i++) {
			const offerElement = offerElements[i];

			const rentEl = await page.$x(
				`//div[@class="row flat-data"][${
					i + 1
				}]//div[contains(text(), "Warmmiete")]/following-sibling::div`,
			) || [null];
			const rent = (await page.evaluate((el) => el.textContent, rentEl.at(0))).trim().replace(
				/[^A-Z0-9€,]/ig,
				' ',
			);

			const sizeEl = await page.$x(
				`//div[@class="row flat-data"][${
					i + 1
				}]//div[contains(text(), "Wohnfläche")]/following-sibling::div`,
			) || [null];
			const size = (await page.evaluate((el) => el.textContent, sizeEl.at(0))).trim();

			const roomsEl = await page.$x(
				`//div[@class="row flat-data"][${
					i + 1
				}]//div[contains(text(), "Zimmer")]/following-sibling::div`,
			) || [null];
			const rooms = (await page.evaluate((el) => el.textContent, roomsEl.at(0))).trim();

			const address = await offerElement.$eval(
				'div.address a',
				(el: HTMLLinkElement) => el.textContent,
			);
			const match = address?.match(/^(.*)(?:, ?)(\d*)(?:.*, )(.*)$/) || [];
			const street = match[1] || null;
			const zip = match[2] || null;
			const district = match[3] || null;

			const url = await offerElement.$eval(
				'div.address a',
				(el: HTMLLinkElement) => el.href,
			);

			const wbsEl = await page.$x(
				`//div[@class="row flat-data"][${i + 1}]//div[contains(text(), "WBS erforderlich")]`,
			);
			const wbs = !!(wbsEl?.length && wbsEl.length >= 1);

			const offer: Offer = {
				rent,
				size,
				rooms: Number(rooms),
				url,
				street,
				zip,
				district,
				wbs,
			};

			offers.push(offer);
		}

		return offers;
	}

	async fillForm(page: Page, profile: Profile): Promise<void> {
		const applyBtn = await page.$x('//a[contains(text(), "Anfrage senden")]');
		const applyUrl = await page.evaluate((el: HTMLLinkElement) => el.href, applyBtn.at(0));

		await this.visitOfferLink(page, applyUrl);

		await page.waitForSelector('div.step-content.show');

		// Step 1
		const step1 = await page.$('div.step-content.show');
		await step1?.waitForSelector('xpath///h3[contains(text(), "Hinweis zum Vermietungsprozess")]');

		const checkbox1 = await step1?.$('input.form-check-input');
		await checkbox1?.click();

		const next1 = await step1?.$('button[data-process-next="2"]');
		await next1?.click();

		// Step 2
		await page.waitForSelector('div.step-content.show');
		const step2 = await page.$('div.step-content.show');
		await step2?.waitForSelector(
			'xpath///h3[contains(text(), "Hinweis zum Wohnungsberechtigungsschein (WBS):")]',
		);

		const checkbox2 = await step2?.$('input.form-check-input');
		await checkbox2?.click();

		const next2 = await step2?.$('button[data-process-next="3"]');
		await next2?.click();

		// Step 3
		await page.waitForSelector('div.step-content.show');
		const step3 = await page.$('div.step-content.show');
		await step3?.waitForSelector(
			'xpath///h3[contains(text(), "Hinweis zum Haushaltsnettoeinkommen:")]',
		);

		const checkbox3 = await step3?.$('input.form-check-input');
		await checkbox3?.click();

		const next3 = await step3?.$('button[data-process-next="4"]');
		await next3?.click();

		// Step 4
		await page.waitForSelector('div.step-content.show');
		const step4 = await page.$('div.step-content.show');
		await step4?.waitForSelector('xpath///h3[contains(text(), "Hinweis zur Bonitätsauskunft:")]');

		const checkbox4 = await step4?.$('input.form-check-input');
		await checkbox4?.click();

		const next4 = await step4?.$('button[data-process-next="5"]');
		await next4?.click();

		// Step 5
		await page.waitForSelector('div.step-content.show');
		const step5 = await page.$('div.step-content.show');
		await step5?.waitForSelector('xpath///h3[contains(text(), "Jetzt Wohnung anfragen")]');

		await page.type(
			'input[name="tx_howrealestate_visitform[visitRequest][firstName]"]',
			profile.name,
		);
		await page.type(
			'input[name="tx_howrealestate_visitform[visitRequest][lastName]"]',
			profile.surname,
		);
		await page.type(
			'input[name="tx_howrealestate_visitform[visitRequest][email]"]',
			profile.email,
		);
		await page.type(
			'input[name="tx_howrealestate_visitform[visitRequest][phone]"]',
			profile.phone,
		);

		const next5 = await step5?.$('button[data-process-step="6"]');
		await next5?.click();
	}

	async submitForm(page: Page): Promise<void> {
		await page.click('button[data-process-step="6"]');
	}

	async applyForOffer(page: Page, profile: Profile): Promise<boolean> {
		await this.fillForm(page, profile);
		await this.submitForm(page);
		await page.waitForXPath(
			'//div[contains(text(), "Ihre Anfrage wurde erfolgreich an die HOWOGE gesandt.")]',
		);
		return true;
	}
}
