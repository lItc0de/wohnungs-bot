import { Client, env } from '../../deps.ts';
import { DBOffer, type Offer } from '../definitions.d.ts';
import Profiles from './profile.ts';

export default class DataBase {
	static URL = Deno.env.get('DATABASE_URL') || env.DATABASE_URL;
	sql: Client;
	profiles: Profiles;

	constructor() {
		this.sql = new Client(`${DataBase.URL}?sslmode=disable`);
		this.profiles = new Profiles(this.sql);
	}

	async init() {
		await this.sql.connect();
	}

	async createOffer(company: string, offer: Offer): Promise<string> {
		const id = crypto.randomUUID();

		await this.sql.queryArray`
			INSERT INTO flats (id, company, rent, size, rooms, url, wbs)
			VALUES (${id}, ${company}, ${offer.rent}, ${offer.size}, ${offer.rooms}, ${offer.url}, ${offer.wbs})
			ON CONFLICT (url) DO NOTHING;
		`;

		return id;
	}

	async updateOffer(id: string, wbs: boolean | null) {
		await this.sql.queryArray`
			UPDATE flats SET wbs = ${wbs} WHERE id = ${id}
		`;
	}

	async getNewOffers(
		companyIdentifier: string,
	): Promise<DBOffer[]> {
		const result = await this.sql.queryObject<DBOffer>`
			SELECT id, url, rooms, wbs FROM flats
			WHERE company = ${companyIdentifier}
			AND is_new = true
		`;

		return result.rows;
	}

	async markOfferProcessed(flatId: string) {
		await this.sql.queryArray`
			UPDATE flats SET is_new = FALSE WHERE id = ${flatId}
		`;
	}

	async updateApplied(flatId: string, profileId: string): Promise<void> {
		await this.sql.queryArray`
			INSERT INTO flats_profiles (flat_id, profile_id)
			VALUES (${flatId}, ${profileId})
		`;
	}

	async close() {
		await this.sql.end();
	}
}
