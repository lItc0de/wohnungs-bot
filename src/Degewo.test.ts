import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database.ts';
import config from '../tests/dummy-data/search-config.json' assert { type: 'json' };
import Degewo from './Degewo.ts';
import { Offer } from './definitions.d.ts';

Deno.env.set('TEST', 'true');
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

const timestamp = Date.now();

await Deno.test('Degewo', async (t) => {
	await setup();

	const db = new DataBase();
	await db.sql.connect();

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const degewoBot = new Degewo(page, config, db);

	const offer1Url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/wohnung1.html'))
		.toString();

	const offer2Url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/wohnung2.html'))
		.toString();

	const offer3Url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/wohnung3.html'))
		.toString();

	const offer4Url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/wohnung4.html'))
		.toString();

	const offer5Url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/wohnung5.html'))
		.toString();

	const offerUrls = [offer1Url, offer2Url, offer3Url, offer4Url, offer5Url];

	const expectedOffers = [
		{
			rent: '298,83 €',
			size: '31,2 m²',
			rooms: 1,
			url: offer1Url,
			wbs: true,
		},
		{
			rent: '305,06 €',
			size: '31,2 m²',
			rooms: 1,
			url: offer2Url,
			wbs: true,
		},
		{
			rent: '335,46 €',
			size: '35 m²',
			rooms: 1,
			url: offer3Url,
			wbs: true,
		},
		{
			rent: '403,08 €',
			size: '42,9 m²',
			rooms: 2,
			url: offer4Url,
			wbs: false,
		},
		{
			rent: '519,40 €',
			size: '36,2 m²',
			rooms: 1,
			url: offer5Url,
			wbs: false,
		},
	];

	await t.step('single steps', async (t) => {
		degewoBot.url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/index.html'))
			.toString();

		await t.step('getAllOffers', async () => {
			await degewoBot.visitMainPage();
			const offers = await degewoBot.getAllOffers();
			assertEquals(offers, expectedOffers);
		});

		await t.step('storeOffers', async () => {
			await degewoBot.storeOffers(expectedOffers);
			const offers = await db.sql.queryObject<typeof expectedOffers[0]>`
        SELECT rent, size, rooms, url, wbs FROM flats
        ORDER BY created_at
      `;

			assertEquals(offers.rows, expectedOffers);
		});

		await t.step('getRelevantOffers', async () => {
			const expected = await db.sql.queryObject<{ id: string; url: string }>`
        SELECT id, url FROM flats
        WHERE url = ${offer4Url}
        ORDER BY created_at
      `;

			const relevantOffers = await degewoBot.getRelevantOffers(timestamp);

			assertEquals(relevantOffers, expected.rows);
		});

		await t.step('applyForOffers', async () => {
			await degewoBot.visitOfferLink(offer1Url);

			await degewoBot.fillForm(config.searches[1].info);

			// TODO: find da way to test gender

			const name = await page.$eval(
				'input#lastName',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(name, config.searches[1].info.name);

			const vorname = await page.$eval(
				'input#firstName',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(vorname, config.searches[1].info.surname);

			const email = await page.$eval(
				'input#email',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(email, config.searches[1].info.email);

			const telefon = await page.$eval(
				'input#phone-number',
				(el: HTMLInputElement) => el.value,
			);
			assertEquals(telefon, config.searches[1].info.phone);
		});
	});

	await t.step('complete run', async (t) => {
		await t.step('run', async () => {
			const offerstAfterRun = [...expectedOffers] as Offer[];
			offerstAfterRun[0].applied = false;
			offerstAfterRun[1].applied = false;
			offerstAfterRun[2].applied = false;
			offerstAfterRun[3].applied = true;
			offerstAfterRun[4].applied = false;

			await degewoBot.run();

			const databaseOffers = await db.sql.queryObject<
				{
					rent: string;
					size: string;
					rooms: number;
					url: string;
					wbs: boolean | null;
					applied: boolean;
				}
			> /* sql */`
        SELECT rent, size, rooms, url, wbs, applied FROM flats
        WHERE url = ANY(${offerUrls})
        ORDER BY created_at
      `;

			assertEquals(databaseOffers.rows, offerstAfterRun);
		});
	});

	await page.close();
	await browser.close();
	await db.close();
	await cleanup();
});
