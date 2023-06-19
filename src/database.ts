import { Client, env } from '../deps.ts';
import { type Offer } from './definitions.d.ts';

export default class DataBase {
	static dbMigrateVersion = 3;
	static URL = Deno.env.get('DATABASE_URL') || env.DATABASE_URL;
	sql: Client;

	constructor() {
		this.sql = new Client(`${DataBase.URL}?sslmode=disable`);
	}

	async init() {
		await this.sql.connect();
		await this.migrate();
	}

	async migrate() {
		if (DataBase.dbMigrateVersion <= 1) await this.migrate_1();
		if (DataBase.dbMigrateVersion <= 2) await this.migrate_2();
	}

	private async migrate_1() {
		try {
			const transaction = this.sql.createTransaction('migrate1');
			await transaction.begin();

			await transaction.queryArray /* sql */`
			CREATE OR REPLACE FUNCTION trigger_set_timestamp()
			RETURNS TRIGGER AS $$
			BEGIN
				NEW.updated_at = NOW();
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql;
			`;

			await transaction.queryArray /* sql */`
			CREATE TABLE IF NOT EXISTS flats (
				id uuid PRIMARY KEY NOT NULL,
				company VARCHAR ( 50 ) NOT NULL,
				rent VARCHAR ( 50 ),
				size VARCHAR ( 50 ),
				rooms INT,
				wbs BOOLEAN,
				url VARCHAR ( 255 ) UNIQUE NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
			`;

			await transaction.queryArray /* sql */`
			CREATE TRIGGER set_timestamp
			BEFORE UPDATE ON flats
			FOR EACH ROW
			EXECUTE PROCEDURE trigger_set_timestamp();
			`;

			await transaction.queryArray /* sql */`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_flats_url ON flats (url ASC);
			`;

			await transaction.commit();
		} catch (error) {
			throw error;
		}
	}

	async migrate_2() {
		await this.sql.queryArray`
		ALTER TABLE flats
		ADD COLUMN applied BOOLEAN DEFAULT false
		`
	}

	async createOffer(company: string, offer: Offer) {
		const id = crypto.randomUUID();

		await this.sql.queryArray`
			INSERT INTO flats (id, company, rent, size, rooms, url)
			VALUES (${id}, ${company}, ${offer.rent}, ${offer.size}, ${offer.rooms}, ${offer.url})
			ON CONFLICT (url) DO NOTHING;
		`;
	}

	async updateOffer(id: string, wbs: boolean) {
		await this.sql.queryArray`
			UPDATE flats SET wbs = ${wbs} WHERE id = ${id}
		`;
	}

	async getRelevantOffers(
		timestamp: number,
	): Promise<{ id: string; url: string; rooms: number }[]> {
		const result = await this.sql.queryObject<{ id: string; url: string; rooms: number }>`
			SELECT id, url, rooms FROM flats
			WHERE created_at >= to_timestamp(${timestamp  / 1000})
		`;

		return result.rows;
	}

	async updateApplied(offerId: string): Promise<void> {
		await this.sql.queryArray`
		UPDATE flats SET applied = ${true} WHERE id = ${offerId}
		`;
	}

	async close() {
		await this.sql.end();
	}
}
