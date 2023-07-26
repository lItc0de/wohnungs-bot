import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';
import { QueryObjectResult } from 'https://deno.land/x/postgres@v0.17.0/query/query.ts';
import DataBase from './database.ts';
import { cleanup, setup, profile } from '../../tests/helper/db_helper.ts';
import { Offer } from '../definitions.d.ts';

// test setup
DataBase.URL = 'postgres://test:test123@localhost:5432/test';

const companyIdentifier = 'testCompany';

const offerNew: Offer = {
	rent: '1100€',
	rooms: 3,
	size: '52qm',
	url: `https://example.com/offer${crypto.randomUUID()}`,
};

const offerOld: Offer = {
	rent: '1200€',
	rooms: 2,
	size: '50qm',
	url: `https://example.com/offer${crypto.randomUUID()}`,
};

Deno.test('database', async (t) => {
	await setup();
	const db = new DataBase();
	await db.init();

	let offerNewId: string;
	let offerOldId: string;

	await t.step('createOffer', async () => {
		offerNewId = await db.createOffer(companyIdentifier, offerNew);

		const dbOffer: QueryObjectResult<Offer> = await db.sql.queryObject`
      SELECT rent, rooms, size, url from flats
      WHERE id = ${offerNewId}
      ORDER BY created_at
    `;

		assertEquals(offerNew, dbOffer.rows[0]);
	});

	await t.step('updateOffer', async () => {
		const offerBeforeUpdate: QueryObjectResult<{ id: string; wbs: boolean }> = await db.sql
			.queryObject /* sql */`
      SELECT id, wbs from flats
      WHERE id = ${offerNewId}
      ORDER BY created_at
    `;

		assertEquals(null, offerBeforeUpdate.rows[0].wbs);
		const wbs = true;

		await db.updateOffer(offerNewId, wbs);

		const offerAfterUpdate: QueryObjectResult<{ wbs: boolean }> = await db.sql.queryObject`
      SELECT wbs from flats
      WHERE id = ${offerNewId}
      ORDER BY created_at
    `;

		assertEquals(wbs, offerAfterUpdate.rows[0].wbs);
	});

	await t.step('getNewOffers', async () => {
		offerOldId = await db.createOffer(companyIdentifier, offerOld);
		await db.markOfferProcessed(offerOldId);

		const newOffers = await db.getNewOffers(companyIdentifier);

		const expectedNewOffers = [
			{
				id: offerNewId,
				rooms: offerNew.rooms,
				url: offerNew.url,
				wbs: true
			},
		];

		assertEquals(newOffers, expectedNewOffers);
	});

	await t.step('updateApplied', async () => {
		await db.updateApplied(offerNewId, profile.id);

		const flatsProfilesRow: QueryObjectResult<{ flatId: string, profileId: string }> = await db.sql.queryObject`
      SELECT flat_id as "flatId", profile_id as "profileId" from flats_profiles
      WHERE flat_id = ${offerNewId}
    `;

		assertEquals(offerNewId, flatsProfilesRow.rows[0].flatId);
		assertEquals(profile.id, flatsProfilesRow.rows[0].profileId);
	});

	await db.close();
	await cleanup();
});
