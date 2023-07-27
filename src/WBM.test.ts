import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, profile, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database/database.ts';
import config from '../tests/dummy-data/search-config.json' assert { type: 'json' };
import WBM from './WBM.ts';
import { Offer } from './definitions.d.ts';

DataBase.URL = 'postgres://test:test123@localhost:5432/test';

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
		appliedFor: profile.id,
		isNew: false,
		street: 'Auerstrasse 18',
		zip: '10249',
		district: 'Friedrichshain'
	},

	{
		rent: '700,34 €',
		size: '44,44 m²',
		rooms: 3,
		url: offer2Url,
		wbs: true,
		appliedFor: null,
		isNew: false,
		street: 'Auerstrasse 18',
		zip: '10249',
		district: 'Friedrichshain'
	},

	{
		rent: '800,34 €',
		size: '84,44 m²',
		rooms: 5,
		url: offer3Url,
		wbs: false,
		appliedFor: null,
		isNew: false,
		street: 'Auerstrasse 18',
		zip: '10249',
		district: 'Friedrichshain'
	},
];

await Deno.test('WBM', async (t) => {
	await setup();

	const db = new DataBase();
	await db.init();

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const wbmBot = new WBM(page, db);

	wbmBot.url = toFileUrl(resolve('tests/dummy-data/wbm/multiple-flats/index.html')).toString();

	await t.step('multiple flats', async (t) => {
		await t.step('run', async () => {
			await wbmBot.run();

			const databaseOffers = await db.sql.queryObject<
				{
					url: string;
					rooms: number;
					rent: string | null;
					size: string | null;
					wbs: boolean | null;
					appliedFor: string | null;
					isNew: boolean,
					street: string | null;
					zip: string | null;
					district: string | null;
				}
			> /* sql */`
        SELECT rent, size, rooms, url, wbs, profile_id as "appliedFor", is_new as "isNew", street, zip, district FROM flats
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
