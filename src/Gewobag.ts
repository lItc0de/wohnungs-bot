import { type ElementHandle, type Page } from '../deps.ts';
import BaseBot from './BaseBot.ts';
import type DataBase from './database/database.ts';
import { type Offer, Profile } from './definitions.d.ts';
import { createScreenhot, timeout } from './utils.ts';

const url =
	'https://www.gewobag.de/fuer-mieter-und-mietinteressenten/mietangebote/?bezirke%5B%5D=charlottenburg-wilmersdorf&bezirke%5B%5D=charlottenburg-wilmersdorf-charlottenburg&bezirke%5B%5D=friedrichshain-kreuzberg&bezirke%5B%5D=friedrichshain-kreuzberg-friedrichshain&bezirke%5B%5D=friedrichshain-kreuzberg-kreuzberg&bezirke%5B%5D=neukoelln&bezirke%5B%5D=pankow&bezirke%5B%5D=pankow-prenzlauer-berg&bezirke%5B%5D=tempelhof-schoeneberg&bezirke%5B%5D=tempelhof-schoeneberg-schoeneberg&objekttyp%5B%5D=wohnung&gesamtmiete_von=&gesamtmiete_bis=&gesamtflaeche_von=&gesamtflaeche_bis=&zimmer_von=&zimmer_bis=&sort-by=recent';

export default class Gewobag extends BaseBot {
	constructor(db: DataBase) {
		const companyIdentifier = 'Gewobag';
		super(db, url, companyIdentifier);
	}

	async getAllOffersFromPage(page: Page): Promise<Offer[]> {
		const offerElements = (await page.$$('article.angebot-big-layout')) as ElementHandle<
			HTMLDivElement
		>[];

		const offers: Offer[] = [];

		for (let i = 0; i < offerElements.length; i++) {
			const offerElement = offerElements[i];

			const rentRaw = await offerElement.$eval(
				'tr.angebot-kosten > td',
				(el: HTMLDivElement) => el.textContent,
			);
			const rent = (rentRaw?.match(/^(?:ab )(.*)$/) || [null, null]).at(1)?.replace(/ ?€/, ' €');

			const dimensionsRaw = await offerElement.$eval(
				'tr.angebot-area > td',
				(el: HTMLDivElement) => el.textContent,
			);
			const dimensions = dimensionsRaw?.match(/^(\d)(?:.*\| )(.*)$/);
			const size = dimensions?.at(2);
			const rooms = dimensions?.at(1);

			const addressRaw = await offerElement.$eval(
				'address',
				(el: HTMLDivElement) => el.textContent,
			);

			const address = addressRaw?.replaceAll(/\n/g, ' ').match(/^(.*)(?:, ?)(\d*)(?:.*\/)(.*)$/) || [];
			const street = address.at(1)?.trim() || null;
			const zip = address.at(2)?.trim() || null;
			const district = address.at(3)?.trim() || null;

			const url = await offerElement.$eval('a.read-more-link', (el: HTMLLinkElement) => el.href);

			const wbs = (await offerElement.$('div.hexagon-icon.typ-wbs')) != null;

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
		await page.waitForSelector('div#BorlabsCookieBox');
		page.click('a#CookieBoxSaveButton');
		await page.waitForSelector('div#BorlabsCookieBox>div.borlabs-hide');
		await timeout(1000);

		await page.click('button[data-tab="rental-contact"]');
		await page.waitForSelector('div#rental-contact:not([disabled])');

		await page.waitForSelector('iframe#contact-iframe');
		const iframeEL = await page.$('iframe#contact-iframe');
		const frame = await iframeEL?.contentFrame();
		if (frame == null) return;

		await frame.waitForSelector('form.application-form');

		await frame.waitForSelector('nz-select.ng-tns-c3-0.ant-select[formcontrolname="salutation"]');
		const selectBtn = await frame.$('nz-select.ng-tns-c3-0.ant-select[formcontrolname="salutation"]');
		await selectBtn?.evaluate((el) => el.click());

		await createScreenhot(page);

		await frame.waitForXPath(`//li[contains(text(), "${profile.gender}")]`);
		const selectEl = await frame.$x(`//li[contains(text(), "${profile.gender}")]`);
		await selectEl.at(0)?.evaluate((el) => el.click());

		await frame.type('input#firstName', profile.surname);
		await frame.type('input#lastName', profile.name);
		await frame.type('input#email', profile.email);
		await frame.type('input#phone-number', profile.phone);
		await frame.type('input#street', profile.street.split(' ')[0]);
		await frame.type('input#house-number', profile.street.split(' ')[1]);
		await frame.type('input#house-number', profile.street.split(' ')[1]);
		await frame.type('input#zip-code', profile.plz);
		await frame.type('input#city', profile.city);
		await frame.type('input#formly_2_input_gewobag_gesamtzahl_der_einziehenden_personen_erwachsene_und_kinder_0', '1');

		await frame.waitForSelector('nz-select#formly_3_select_gewobag_fuer_wen_wird_die_wohnungsanfrage_gestellt_0');
		const select2Btn = await frame.$('nz-select#formly_3_select_gewobag_fuer_wen_wird_die_wohnungsanfrage_gestellt_0');
		await select2Btn?.evaluate((el) => el.click());
		await frame.waitForXPath(`//li[contains(text(), "Für mich selbst oder meine Angehörigen")]`);
		const select2El = await frame.$x(`//li[contains(text(), "Für mich selbst oder meine Angehörigen")]`);
		await select2El.at(0)?.evaluate((el) => el.click());

		const wbsLabels = await frame.$$('nz-radio-group[id="formly_4_radio_$$_wbs_available_$$_0"]>label');
		if (profile.wbs) await wbsLabels.at(0)?.evaluate((el) => el.click());
		else await wbsLabels.at(1)?.evaluate((el) => el.click());

		const ageLabels = await frame.$$('nz-radio-group[id="formly_9_radio_gewobag_mindestalter_seniorenwohnhaus_erreicht_0"]>label');
		await ageLabels.at(1)?.evaluate((el) => el.click());

		const dataProtectionLabelEl = await frame.$('label#formly_12_checkbox_gewobag_datenschutzhinweis_bestaetigt_0');
		dataProtectionLabelEl?.evaluate((el) => el.click());
		await frame.waitForSelector('button[type="submit"]:not([disabled])');
	}

	async submitForm(page: Page): Promise<void> {
		const iframeEL = await page.$('iframe#contact-iframe');
		const frame = await iframeEL?.contentFrame();
		if (frame == null) return;

		await frame.click('button[type="submit"]:not([disabled])');
	}

	async applyForOffer(page: Page, profile: Profile): Promise<boolean> {
		await this.fillForm(page, profile);
		// await this.submitForm(page);
		return true;
	}
}
