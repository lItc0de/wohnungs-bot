import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, profile, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database/database.ts';
import Gewobag from './Gewobag.ts';

Deno.env.set('TEST', 'true');
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

const offer1Url = toFileUrl(resolve('tests/dummy-data/gewobag/wohnung1.html'))
	.toString();

const offer2Url = toFileUrl(resolve('tests/dummy-data/gewobag/wohnung2.html'))
	.toString();

const offerUrls = [offer1Url, offer2Url];

const expectedOffers = [
	{
		rent: '562,31 €',
		size: '28,32 m²',
		rooms: 2,
		url: offer1Url,
		wbs: false,
		appliedFor: profile.id,
		street: 'Schwielowseestr. 40',
		district: 'Spandau1',
		zip: '13599',
	},
	{
		rent: '403,93 €',
		size: '28,22 m²',
		rooms: 1,
		url: offer2Url,
		wbs: true,
		appliedFor: null,
		street: 'Holtheimer Weg 25',
		district: 'Steglitz-Zehlendorf',
		zip: '12207',
	},
];

await Deno.test('Gewobag', async (t) => {
	await setup();

	const db = new DataBase();
	await db.init();

	const gewobagBot = new Gewobag(db);
	gewobagBot.url = toFileUrl(resolve('tests/dummy-data/gewobag/index.html'))
		.toString();

	await t.step('complete run', async (t) => {
		await t.step('run', async () => {
			await gewobagBot.run();

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

	await db.close();
	await cleanup();
});
