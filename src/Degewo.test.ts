import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, profile, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database/database.ts';
import Degewo from './Degewo.ts';
import { Offer } from './definitions.d.ts';

Deno.env.set('TEST', 'true');
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

const offer1Url = toFileUrl(resolve('tests/dummy-data/degewo/wohnung1.html'))
	.toString();

const offer2Url = toFileUrl(resolve('tests/dummy-data/degewo/wohnung2.html'))
	.toString();

const offerUrls = [offer1Url, offer2Url];

const expectedOffers = [
	{
		rent: '346,03 €',
		size: '53,4 m²',
		rooms: 1,
		url: offer1Url,
		wbs: false,
		appliedFor: null,
		street: 'Zwickauer Damm 12',
		district: 'Neukölln',
		zip: '12353',
	},
	{
		rent: '477,96 €',
		size: '79,7 m²',
		rooms: 2,
		url: offer2Url,
		wbs: false,
		appliedFor: profile.id,
		street: 'Zwickauer Damm 12',
		district: 'Neukölln',
		zip: '12353',
	},
];

await Deno.test('Degewo', async (t) => {
	await setup();

	const db = new DataBase();
	await db.init();

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const degewoBot = new Degewo(page, db);
	degewoBot.url = toFileUrl(resolve('tests/dummy-data/degewo/index.html'))
		.toString();

	await t.step('complete run', async (t) => {
		await t.step('run', async () => {
			await degewoBot.run();

			const databaseOffers = await db.sql.queryObject<
				{
					url: string;
					rooms: number;
					rent: string | null;
					size: string | null;
					wbs: boolean | null;
					appliedFor: string | null;
					street: string | null;
					zip: string | null;
					district: string | null;
				}
			> /* sql */`
        SELECT rent, size, rooms, url, wbs, profile_id as "appliedFor", street, zip, district FROM flats
				LEFT JOIN flats_profiles ON id = flat_id
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
