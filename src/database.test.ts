import { assert } from 'https://deno.land/std@0.191.0/testing/asserts.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';
import { QueryObjectResult } from 'https://deno.land/x/postgres@v0.17.0/query/query.ts';
import { delay } from 'https://deno.land/std@0.192.0/async/delay.ts';
import DataBase from './database.ts';
import { cleanup, setup } from '../tests/helper/db_helper.ts';
import { Offer } from './definitions.d.ts';

// test setup
DataBase.dbMigrateVersion = 1;
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

Deno.test('database', async (t) => {
	await setup(false);
	const db = new DataBase();
	await db.sql.connect();

	await t.step('migrate', async () => {
		await db.migrate();
		const testExists = await db.sql.queryArray`
    SELECT EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public' AND tablename  = 'flats'
    );
    `;

		assert(testExists.rows[0][0]);
	});

	await t.step('createOffer', async () => {
		const offer: Offer = {
			rent: '1200€',
			rooms: 2,
			size: '50qm',
			url: `https://example.com/offer${crypto.randomUUID()}`,
		};

		await db.createOffer('testCompany', offer);

		const dbOffer: QueryObjectResult<Offer> = await db.sql.queryObject`
      SELECT rent, rooms, size, url from flats
      ORDER BY created_at
      LIMIT 1
    `;

		assertEquals(offer, dbOffer.rows[0]);
	});

	await t.step('updateOffer', async () => {
		const offerBeforeUpdate: QueryObjectResult<{ id: string; wbs: boolean }> = await db.sql
			.queryObject`
      SELECT id, wbs from flats
      ORDER BY created_at
      LIMIT 1
    `;

		assertEquals(null, offerBeforeUpdate.rows[0].wbs);

		const offerId = offerBeforeUpdate.rows[0].id;
		const wbs = true;

		await db.updateOffer(offerId, wbs);

		const offerAfterUpdate: QueryObjectResult<{ wbs: boolean }> = await db.sql.queryObject`
      SELECT wbs from flats
      ORDER BY created_at
      LIMIT 1
    `;

		assertEquals(wbs, offerAfterUpdate.rows[0].wbs);
	});

	await t.step('getRelevantOffers', async () => {
		const offerNonRelevant: Offer = {
			rent: '1200€',
			rooms: 2,
			size: '50qm',
			url: `https://example.com/offer${crypto.randomUUID()}`,
		};

		await db.createOffer('testCompany', offerNonRelevant);

		await delay(100);
		const timestamp = Date.now();

		const offerRelevant: Offer = {
			rent: '1100€',
			rooms: 3,
			size: '52qm',
			url: `https://example.com/offer${crypto.randomUUID()}`,
		};

		await db.createOffer('testCompany', offerRelevant);

		const relevantOffers = await db.getRelevantOffers(timestamp);

		const expectedRelevantOfferId = (await db.sql.queryObject<{ id: string }>`
      SELECT id from flats
      ORDER BY created_at DESC
      LIMIT 1
    `).rows[0].id;

		const expectedRelevantOffers = [
			{
				id: expectedRelevantOfferId,
				rooms: offerRelevant.rooms,
				url: offerRelevant.url,
			},
		];

		assertEquals(relevantOffers, expectedRelevantOffers);
	});

	await t.step('updateApplied', async () => {
		const offerBeforeUpdate: QueryObjectResult<{ id: string; applied: boolean }> = await db.sql
			.queryObject`
      SELECT id, applied from flats
      ORDER BY created_at
      LIMIT 1
    `;

		assertEquals(false, offerBeforeUpdate.rows[0].applied);

		const offerId = offerBeforeUpdate.rows[0].id;
		const applied = true;

		await db.updateApplied(offerId);

		const offerAfterUpdate: QueryObjectResult<{ applied: boolean }> = await db.sql.queryObject`
      SELECT applied from flats
      ORDER BY created_at
      LIMIT 1
    `;

		assertEquals(applied, offerAfterUpdate.rows[0].applied);
	});

	await db.close();
	await cleanup();
});
