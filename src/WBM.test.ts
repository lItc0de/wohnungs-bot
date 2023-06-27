import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database.ts';
import config from '../tests/dummy-data/search-config.json' assert { type: 'json' };
import WBM from './WBM.ts';

DataBase.URL = 'postgres://test:test123@localhost:5432/test';

await Deno.test('WBM', async (t) => {
	await setup();

	const db = new DataBase();
	await db.sql.connect();

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const wbmBot = new WBM(page, config, db);

	await t.step('single flat', async (t) => {
		wbmBot.url = toFileUrl(resolve('tests/dummy-data/wbm/one-flat-no-wbs/index.html')).toString();

		const expectedOfferUrl = toFileUrl(resolve('tests/dummy-data/wbm/one-flat-no-wbs/wohnung.html'))
			.toString();

		const expectedOffers = [
			{
				rent: '634,47 €',
				size: '58,65 m²',
				rooms: 2,
				url: expectedOfferUrl,
			},
		];

		await t.step('getAllOffers', async () => {
			await wbmBot.visitMainPage();
			const offers = await wbmBot.getAllOffers();
			assertEquals(offers, expectedOffers);
		});

		await t.step('storeOffers', async () => {
			await wbmBot.storeOffers(expectedOffers);
			const offers = await db.sql.queryObject<typeof expectedOffers[0]>`
        SELECT rent, size, rooms, url FROM flats
        ORDER BY created_at DESC
        LIMIT 1
      `;

			assertEquals(offers.rows, expectedOffers);
		});

		await t.step('applyForOffers', async () => {
			const offers = await db.sql.queryObject<
				{ id: string; url: string; wbs: boolean; applied: boolean }
			>`
        SELECT id, url, wbs, applied FROM flats
        ORDER BY created_at DESC
        LIMIT 1
      `;

			const { wbs, applied, url, id } = offers.rows[0];

			assertEquals({ wbs, applied }, { wbs: null, applied: false });

			await wbmBot.visitOfferLink(url);

			const noWbs = await wbmBot.checkNoWbs(id);

			assertEquals(noWbs, true);

			await wbmBot.fillForm(config.searches[1].info);

			const gender = await page.$eval(
				'select#powermail_field_anrede',
				(el: HTMLSelectElement) => el.value,
			);
			assertEquals(gender, config.searches[1].info.gender);

			const name = await page.$eval(
				'input#powermail_field_name',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(name, config.searches[1].info.name);

			const vorname = await page.$eval(
				'input#powermail_field_vorname',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(vorname, config.searches[1].info.surname);

			const strasse = await page.$eval(
				'input#powermail_field_strasse',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(strasse, config.searches[1].info.street);

			const plz = await page.$eval('input#powermail_field_plz', (el: HTMLInputElement) => el.value);
			assertEquals(plz, config.searches[1].info.plz);

			const ort = await page.$eval('input#powermail_field_ort', (el: HTMLInputElement) => el.value);
			assertEquals(ort, config.searches[1].info.city);

			const email = await page.$eval(
				'input#powermail_field_e_mail',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(email, config.searches[1].info.email);

			const telefon = await page.$eval(
				'input#powermail_field_telefon',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(telefon, config.searches[1].info.phone);

			const dataProtection = await page.$eval(
				'input#powermail_field_datenschutzhinweis_1',
				(el: HTMLInputElement) => el.checked,
			);
			assertEquals(dataProtection, true);

			// await page.waitForSelector('form[method="post"]');
			await page.evaluate(() => {
				console.log('evaluate');
				const forms = document.querySelectorAll('form[method="post"]');
				const form = forms[0] as HTMLFormElement;

				form.addEventListener('submit', (e: SubmitEvent) => {
					e.preventDefault();
				});
			});

			await wbmBot.updateApplied(id);
		});
	});

	await t.step('multiple flats', async (t) => {
		wbmBot.url = toFileUrl(resolve('tests/dummy-data/wbm/multiple-flats/index.html')).toString();

		const offer1Url = toFileUrl(resolve('tests/dummy-data/wbm/multiple-flats/wohnung1.html'))
			.toString();

		const offer2Url = toFileUrl(resolve('tests/dummy-data/wbm/multiple-flats/wohnung2.html'))
			.toString();

		const offer3Url = toFileUrl(resolve('tests/dummy-data/wbm/multiple-flats/wohnung3.html'))
			.toString();

		const offerUrls = [offer1Url, offer2Url, offer3Url];

		const expectedOffers = [
			{
				rent: '634,47 €',
				size: '58,65 m²',
				rooms: 2,
				url: offer1Url,
				wbs: false,
				applied: true,
			},

			{
				rent: '700,34 €',
				size: '44,44 m²',
				rooms: 3,
				url: offer2Url,
				wbs: true,
				applied: false,
			},

			{
				rent: '800,34 €',
				size: '84,44 m²',
				rooms: 4,
				url: offer3Url,
				wbs: null,
				applied: false,
			},
		];

		await t.step('run', async () => {
			await wbmBot.run();

			const databaseOffers = await db.sql.queryObject<
				{ rent: string; size: string; rooms: number; url: string; wbs: boolean; applied: boolean }
			> /* sql */`
        SELECT rent, size, rooms, url, wbs, applied FROM flats
        WHERE url = ANY(${offerUrls})
        ORDER BY created_at
      `;

			assertEquals(databaseOffers.rows, expectedOffers);
		});
	});

	await page.close();
	await browser.close();
	await db.close();
	await cleanup();
});
