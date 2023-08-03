import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';

import { cleanup, profileWBS, setup } from '../tests/helper/db_helper.ts';
import DataBase from './database/database.ts';
import Howoge from './Howoge.ts';

Deno.env.set('TEST', 'true');
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

const offer1Url = toFileUrl(resolve('tests/dummy-data/howoge/wohnung1.html'))
	.toString();

const offerUrls = [offer1Url];

const expectedOffers = [
	{
		rent: '1017,14 €',
		size: '110 m²',
		rooms: 4,
		url: offer1Url,
		wbs: true,
		appliedFor: profileWBS.id,
		street: 'Wolfgang-Heinz-Straße 40',
		district: 'Buch',
		zip: '13125',
	},
];

await Deno.test('Howoge', async (t) => {
	await setup(profileWBS);

	const db = new DataBase();
	await db.init();

	const howogeBot = new Howoge(db);
	howogeBot.url = toFileUrl(resolve('tests/dummy-data/howoge/index.html'))
		.toString();

	await t.step('complete run', async (t) => {
		await t.step('run', async () => {
			await howogeBot.run();

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
