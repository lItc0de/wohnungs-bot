import {
	type Browser,
	ConnectionError,
	type LaunchOptions,
	type Page,
	puppeteer,
} from '../deps.ts';
import type DataBase from './database/database.ts';
import { AdditinalOfferInformation, DBOffer, type Offer, type Profile } from './definitions.d.ts';
import { logger } from './utils.ts';

const districtBlacklist = [
	'Spandau',
	'Buch',
	'Steglitz-Zehlendorf',
];

export default class BaseBot {
	private isProd: boolean;
	private launchOptions: LaunchOptions = {};

	url: string;

	protected companyIdentifier: string;
	protected db: DataBase;
	protected browser?: Browser;

	constructor(
		db: DataBase,
		url: string,
		companyIdentifier: string,
	) {
		this.isProd = Deno.env.get('PRODUCTION') === 'true';
		this.db = db;
		this.url = url;
		this.companyIdentifier = companyIdentifier;

		if (this.isProd) {
			this.launchOptions = {
				executablePath: '/usr/bin/google-chrome',
			};
		}
	}

	protected async visitOfferLink(page: Page, offerLink: string): Promise<void> {
		await page.goto(offerLink);
	}

	private async storeOffers(offers: Offer[]): Promise<void> {
		for (let i = 0; i < offers.length; i++) {
			await this.db.createOffer(this.companyIdentifier, offers[i]);
		}
	}

	private isOfferRelevant(offer: DBOffer, profile: Profile): boolean {
		const roomCheck = profile.minRooms <= offer.rooms && profile.maxRooms >= offer.rooms;
		const wbsCheck = offer.wbs ? profile.wbs : true;
		const districtCheck = !districtBlacklist.includes(offer.district || '');

		return roomCheck && wbsCheck && districtCheck;
	}

	private async cleanupPages() {
		const pages = await this.browser?.pages();
		if (pages?.length && pages.length > 0) {
			for (let i = 0; i < pages.length; i++) {
				const page = pages.at(i);
				if (page == null) continue;
				if (page.isClosed() === false) await page.close();
			}
		}
		await this.browser?.close();
	}

	private async runGatherNewOffers(): Promise<DBOffer[]> {
		const page = await this.browser?.newPage();
		if (page == null) return [];

		let newOffers: DBOffer[] = [];

		try {
			await page.goto(this.url);

			const offers = await this.getAllOffersFromPage(page);

			logger(`${this.companyIdentifier}: Found ${offers.length} offers.`);
			if (offers.length === 0) return [];

			logger(`${this.companyIdentifier}: Storing...`);
			await this.storeOffers(offers);

			newOffers = await this.db.getNewOffers(this.companyIdentifier);

			logger(`${this.companyIdentifier}: Found ${newOffers.length} new offers`);

			if (newOffers.length === 0) return [];

			for (let i = 0; i < newOffers.length; i++) {
				const offer = newOffers[i];

				await this.visitOfferLink(page, offer.url);
				const additionalOfferInformation = await this.gatherAdditionalOfferInformation(page);

				await this.db.updateOffer(offer.id, additionalOfferInformation);
				newOffers[i] = { ...offer, ...additionalOfferInformation };
			}
		} catch (e) {
			console.error('Error: while gathering information');
			throw e;
		}

		return newOffers;
	}

	private async runApplyNewOffers(newOffers: DBOffer[]) {
		if (newOffers.length === 0) return;

		const page = await this.browser?.newPage();
		if (page == null) return;

		try {
			const enabledProfiles = await this.db.profiles.getEnabledProfiles();
			logger(`${this.companyIdentifier}: Applying for ${enabledProfiles.length} profiles...`);

			for (let i = 0; i < enabledProfiles.length; i++) {
				const profile = enabledProfiles[i];
				logger(`${this.companyIdentifier}: Apply for ${profile.name}`);

				for (let j = 0; j < newOffers.length; j++) {
					const offer = newOffers[j];
					if (!this.isOfferRelevant(offer, profile)) {
						logger(`${this.companyIdentifier}: Offer ${offer.id} not relevant. Skipping...`);
						continue;
					}

					logger(`${this.companyIdentifier}: Applying for offer ${offer.id}...`);

					await this.visitOfferLink(page, offer.url);
					const applied = await this.applyForOffer(page, profile);

					if (applied) await this.db.updateApplied(offer.id, profile.id);
					else `${this.companyIdentifier}: Something went wrong...`;
				}
			}
		} catch (e) {
			console.error('Error: while applying');
			throw e;
		}
	}

	async run(): Promise<void> {
		logger(`${this.companyIdentifier}: Start searching for offers...`);

		try {
			this.browser = await puppeteer.launch(this.launchOptions);

			const newOffers = await this.runGatherNewOffers();
			await this.runApplyNewOffers(newOffers);
		} catch (e) {
			if (e instanceof ConnectionError) {
				await this.db.sql.connect();
				// retry
				await this.run();
			} else {
				console.error(e);
			}
		} finally {
			await this.cleanupPages();
			await this.db.markNewOffersProcessed(this.companyIdentifier);
		}

		logger(`${this.companyIdentifier}: Finished.`);
	}

	// to be implemented by children --->
	protected async getAllOffersFromPage(page: Page): Promise<Offer[]> {
		return [];
	}

	protected async gatherAdditionalOfferInformation(page: Page): Promise<AdditinalOfferInformation> {
		return {};
	}

	protected async applyForOffer(page: Page, profile: Profile): Promise<boolean> {
		return true;
	}
	// <--- end to be implemented by children
}
