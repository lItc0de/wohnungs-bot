import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import WBM from './WBM.ts';
import DataBase from './database.ts';
import config from '../tests/dummy-data/search-config.json' assert { type: 'json' };
import { cleanup, setup } from '../tests/helper/db_helper.ts';
import { resolve, toFileUrl } from 'https://deno.land/std@0.192.0/path/mod.ts';
import { assertEquals } from 'https://deno.land/std@0.160.0/testing/asserts.ts';
import { black } from 'https://deno.land/std@0.160.0/fmt/colors.ts';

DataBase.URL = 'postgres://test:test123@localhost:5432/test';

await Deno.test('WBM', async (t) => {
	await setup();

	const db = new DataBase();
	await db.sql.connect();

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const wbmBot = new WBM(page, config, db);
	wbmBot.url = toFileUrl(resolve('tests/dummy-data/wbm/index.html')).toString();

	const expectedOfferUrl = toFileUrl(resolve('tests/dummy-data/wbm/wohnung.html')).toString();

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


		// await wbmBot.applyForOffers(offers.rows, config.searches[1].info);

		// const appliedOffers = await db.sql.queryObject<{ wbs: boolean; applied: boolean }>`
    //   SELECT wbs, applied FROM flats
    //   ORDER BY created_at DESC
    //   LIMIT 1
    // `;

		// assertEquals(appliedOffers.rows[0], { wbs: false, applied: true });

		const gender = await page.$eval(
			'select#powermail_field_anrede',
			(el: HTMLSelectElement) => el.value,
		);
		assertEquals(gender, config.searches[1].info.gender);

		const name = await page.$eval('input#powermail_field_name', (el: HTMLInputElement) => el.value);
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

    const formData = await page.$eval(
			'form[method="post"]',
			(el: HTMLFormElement) => {
        return el.children.length
      },
		);

    console.log(formData)

    // await wbmBot.submitForm();

    await wbmBot.updateApplied(id);
	});

	await page.close();
	await browser.close();
	await db.close();
	await cleanup();
});
