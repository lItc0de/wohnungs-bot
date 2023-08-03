import { type Browser, type Page, type LaunchOptions, puppeteer } from '../deps.ts';
import type DataBase from './database/database.ts';
import { AdditinalOfferInformation, DBOffer, type Offer, type Profile } from './definitions.d.ts';

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
		console.log(offerLink);

		await page.goto(offerLink);
		console.log('visited');

	}

	private async storeOffers(offers: Offer[]): Promise<void> {
		for (let i = 0; i < offers.length; i++) {
			await this.db.createOffer(this.companyIdentifier, offers[i]);
		}
	}

	private isOfferRelevant(offer: DBOffer, profile: Profile): boolean {
		const roomCheck = profile.minRooms <= offer.rooms && profile.maxRooms >= offer.rooms;
		const wbsCheck = offer.wbs ? profile.wbs : true;

		return roomCheck && wbsCheck;
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

			console.log(`${this.companyIdentifier}: Found ${offers.length} offers.`);
			if (offers.length === 0) return [];

			console.log(`${this.companyIdentifier}: Storing...`);
			await this.storeOffers(offers);

			newOffers = await this.db.getNewOffers(this.companyIdentifier);

			console.log(`${this.companyIdentifier}: Found ${newOffers.length} new offers`);

			if (newOffers.length === 0) return [];

			for (let i = 0; i < newOffers.length; i++) {
				const offer = newOffers[i];

				await this.visitOfferLink(page, offer.url);
				const additionalOfferInformation = await this.gatherAdditionalOfferInformation(page);

				await this.db.updateOffer(offer.id, additionalOfferInformation);
				newOffers[i] = { ...offer, ...additionalOfferInformation };
			}
		} catch (error) {
			console.error('error while gathering information', error);
		} finally {
			await page?.close();
		}

		return newOffers;
	}

	private async runApplyNewOffers(newOffers: DBOffer[]) {
		const page = await this.browser?.newPage();
		if (page == null) return;

		try {
			const enabledProfiles = await this.db.profiles.getEnabledProfiles();
			console.log(`${this.companyIdentifier}: Applying for ${enabledProfiles.length} profiles...`);

			for (let i = 0; i < enabledProfiles.length; i++) {
				const profile = enabledProfiles[i];
				console.log(`${this.companyIdentifier}: Apply for ${profile.name}`);

				for (let j = 0; j < newOffers.length; j++) {
					const offer = newOffers[j];
					if (!this.isOfferRelevant(offer, profile)) {
						console.log(`${this.companyIdentifier}: Offer ${offer.id} not relevant. Skipping...`);
						continue;
					}

					console.log(`${this.companyIdentifier}: Applying for offer ${offer.id}...`);

					await this.visitOfferLink(page, offer.url);
					const applied = await this.applyForOffer(page, profile);

					if (applied) await this.db.updateApplied(offer.id, profile.id);
					else `${this.companyIdentifier}: Something went wrong...`;
				}
			}
		} catch (error) {
			console.error('error while applying', error);
		} finally {
			await page?.close();
		}
	}

	async run(): Promise<void> {
		console.log(`${this.companyIdentifier}: Start searching for offers...`);

		try {
			this.browser = await puppeteer.launch(this.launchOptions);

			const newOffers = await this.runGatherNewOffers();
			await this.runApplyNewOffers(newOffers);


		} catch (error) {
			console.error(error);
		} finally {
			await this.cleanupPages();
			await this.db.markNewOffersProcessed(this.companyIdentifier);
		}

		console.log('Finished.');
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
