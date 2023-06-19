import { type Page } from '../deps.ts';
import searchConfig from '../search-config.json' assert { type: 'json' };
import type DataBase from './database.ts';
import { type Info, type Offer } from './definitions.d.ts';

export default class BaseBot {
	url: string;
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
	) {
		this.page = page;
		this.config = config;
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

	async updateApplied(offerid: string): Promise<void> {
		await this.db.updateApplied(offerid);
	}

	async run(): Promise<void> {
		const currentTimestamp = Date.now();

		console.log('Start searching for offers...');

		await this.visitMainPage();

		const offers = await this.getAllOffers();

    // const offers = [
    //   {company: 'WBM', rent: '345€', size: '34qm', rooms: 3, url: 'http://example.com/123'}
    // ]

		console.log(`Found ${offers.length} offers. Storing...`);

		await this.storeOffers(offers);

		const relevantOffers = await this.getRelevantOffers(currentTimestamp);

		console.log(`Applying for ${relevantOffers.length} relevant offers...`);

		const enabledSearches = this.config.searches.filter((search) => search.enabled);

    console.log(`Applying for ${enabledSearches.length} searches...`);


		for (let i = 0; i < enabledSearches.length; i++) {
			const search = enabledSearches[i];
			await this.applyForOffers(relevantOffers, search.info);
		}

		console.log('Finished.');
	}
}
