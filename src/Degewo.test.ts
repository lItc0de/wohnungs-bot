import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, profile, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database/database.ts';
import Degewo from './Degewo.ts';
import { Offer } from './definitions.d.ts';

Deno.env.set('TEST', 'true');
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

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
		appliedFor: null,
		street: 'Käthe-Dorsch-Ring 1',
		district: 'Neukölln',
		zip: '12353',
	},
	{
		rent: '305,06 €',
		size: '31,2 m²',
		rooms: 1,
		url: offer2Url,
		wbs: true,
		appliedFor: null,
		street: 'Käthe-Dorsch-Ring 1',
		district: 'Neukölln',
		zip: '12353',
	},
	{
		rent: '335,46 €',
		size: '35 m²',
		rooms: 1,
		url: offer3Url,
		wbs: true,
		appliedFor: null,
		street: 'Käthe-Dorsch-Ring 1',
		district: 'Neukölln',
		zip: '12353',
	},
	{
		rent: '403,08 €',
		size: '42,9 m²',
		rooms: 2,
		url: offer4Url,
		wbs: false,
		appliedFor: profile.id,
		street: 'Theodor-Loos-Weg 17',
		district: 'Neukölln',
		zip: '12353',
	},
	{
		rent: '519,40 €',
		size: '36,2 m²',
		rooms: 1,
		url: offer5Url,
		wbs: false,
		appliedFor: null,
		street: 'Ludwig-Renn-Straße 64',
		district: 'Marzahn-Hellersdorf',
		zip: '12679',
	},
];

await Deno.test('Degewo', async (t) => {
	await setup();

	const db = new DataBase();
	await db.init();

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const degewoBot = new Degewo(page, db);
	degewoBot.url = toFileUrl(resolve('tests/dummy-data/degewo/multiple-flats/index.html'))
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
