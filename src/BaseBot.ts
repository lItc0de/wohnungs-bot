import { type Page } from '../deps.ts';
import searchConfig from '../search-config.json' assert { type: 'json' };
import type DataBase from './database.ts';
import { type Info, type Offer } from './definitions.d.ts';

export default class BaseBot {
	url: string;
	runTimestamp: number;
	protected companyIdentifier: string;

	protected page: Page;
	protected db: DataBase;
	protected config: typeof searchConfig;

	constructor(
		page: Page,
		config: typeof searchConfig,
		db: DataBase,
		url: string,
		companyIdentifier: string,
		runTimestamp?: number,
	) {
		this.page = page;
		this.config = config;
		this.db = db;
		this.url = url;
		this.companyIdentifier = companyIdentifier;
		this.runTimestamp = runTimestamp ?? Date.now();
	}

	async visitMainPage(): Promise<void> {
		await this.page.goto(this.url);
	}

	async visitOfferLink(offerLink: string): Promise<void> {
		await this.page.goto(offerLink);
	}

	async getRelevantOffers(timestamp: number): Promise<{ id: string; url: string }[]> {
		return (await this.db.getRelevantOffers(timestamp))
			// check number of rooms
			.filter((offer) => offer.rooms >= 2 || Number.isNaN(offer.rooms))
			// get links
			.map((offer) => ({ id: offer.id, url: offer.url }));
	}

	async storeOffers(offers: Offer[]): Promise<void> {
		for (let i = 0; i < offers.length; i++) {
			await this.db.createOffer(this.companyIdentifier, offers[i]);
		}
	}

	async getAllOffers(): Promise<Offer[]> {
		return await [];
	}

	async checkNoWbs(id: string): Promise<boolean> {
		return await false;
	}

	async fillForm(info: Info): Promise<void> {}

	async submitForm(): Promise<void> {}

	async applyForOffers(offers: { id: string; url: string }[], info: Info): Promise<void> {}

	async updateApplied(offerId: string): Promise<void> {
		console.log('update applied');

		await this.db.updateApplied(offerId);
	}

	resetTimestamp(): void {
		this.runTimestamp = Date.now();
	}

	async run(): Promise<void> {
		console.log('Start searching for offers...');

		await this.visitMainPage();

		const offers = await this.getAllOffers();

		console.log(`Found ${offers.length} offers.`);
		if (offers.length === 0) return;

		console.log('Storing...');
		await this.storeOffers(offers);

		const relevantOffers = await this.getRelevantOffers(this.runTimestamp);

		console.log(`Found ${relevantOffers.length} relevant offers`);

		if (relevantOffers.length === 0) return;

		const enabledSearches = this.config.searches.filter((search) => search.enabled);
		console.log(`Applying for ${enabledSearches.length} searches...`);

		for (let i = 0; i < enabledSearches.length; i++) {
			const search = enabledSearches[i];
			console.log(`Apply for ${search.info.name}`);

			await this.applyForOffers(relevantOffers, search.info);
		}

		console.log('Finished.');
	}
}
