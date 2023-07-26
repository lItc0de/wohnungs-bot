import { type Page } from '../deps.ts';
import type DataBase from './database/database.ts';
import { DBOffer, type Offer, type Profile } from './definitions.d.ts';

export default class BaseBot {
	url: string;

	protected companyIdentifier: string;
	protected page: Page;
	protected db: DataBase;

	constructor(
		page: Page,
		db: DataBase,
		url: string,
		companyIdentifier: string,
	) {
		this.page = page;
		this.db = db;
		this.url = url;
		this.companyIdentifier = companyIdentifier;
	}

	async visitMainPage(): Promise<void> {
		await this.page.goto(this.url);
	}

	async visitOfferLink(offerLink: string): Promise<void> {
		await this.page.goto(offerLink);
	}

	async storeOffers(offers: Offer[]): Promise<void> {
		for (let i = 0; i < offers.length; i++) {
			await this.db.createOffer(this.companyIdentifier, offers[i]);
		}
	}

	isOfferRelevant(offer: DBOffer, profile: Profile): boolean {
		const roomCheck = profile.minRooms <= offer.rooms && profile.maxRooms >= offer.rooms;
		const wbsCheck = offer.wbs ? profile.wbs : true;

		return roomCheck && wbsCheck;
	}

	async run(): Promise<void> {
		try {
			await this._run();
		} catch (error) {
			console.error(error);
		}
	}

	private async _run(): Promise<void> {
		console.log('Start searching for offers...');

		await this.visitMainPage();

		const offers = await this.getAllOffersFromPage();

		console.log(`Found ${offers.length} offers.`);
		if (offers.length === 0) return;

		console.log('Storing...');
		await this.storeOffers(offers);

		const newOffers = await this.db.getNewOffers(this.companyIdentifier);

		console.log(`Found ${newOffers.length} new offers`);

		if (newOffers.length === 0) return;

		for (let i = 0; i < newOffers.length; i++) {
			const offer = newOffers[i];
			await this.visitOfferLink(offer.url);
			const additionalOfferInformation = await this.gatherAdditionalOfferInformation();
			if (
				Object.keys(additionalOfferInformation).includes('wbs') &&
				additionalOfferInformation.wbs !== undefined
			) {
				await this.db.updateOffer(offer.id, additionalOfferInformation.wbs);
				offer.wbs = additionalOfferInformation.wbs;
			}
			await this.db.markOfferProcessed(offer.id);
		}

		const enabledProfiles = await this.db.profiles.getEnabledProfiles();
		console.log(`Applying for ${enabledProfiles.length} profiles...`);

		for (let i = 0; i < enabledProfiles.length; i++) {
			const profile = enabledProfiles[i];
			console.log(`Apply for ${profile.name}`);

			for (let j = 0; j < newOffers.length; j++) {
				const offer = newOffers[j];
				if (!this.isOfferRelevant(offer, profile)) {
					console.log(`Offer ${offer.id} not relevant. Skipping...`);
					continue;
				}

				console.log(`Applying for offer ${offer.id}...`);
				await this.visitOfferLink(offer.url);
				const applied = await this.applyForOffer(profile);
				if (applied) await this.db.updateApplied(offer.id, profile.id);
				else 'Something went wrong...';
			}
		}

		console.log('Finished.');
	}

	// to be implemented by children --->
	async getAllOffersFromPage(): Promise<Offer[]> {
		return await [];
	}

	async gatherAdditionalOfferInformation(): Promise<{ wbs?: boolean | null }> {
		return await { wbs: null };
	}

	async applyForOffer(profile: Profile): Promise<boolean> {
		return await true;
	}
	// <--- end to be implemented by children
}
