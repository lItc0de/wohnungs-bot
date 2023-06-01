import { sqlite } from '../deps.ts';
import { type FlatsRow, type Offer } from './definitions.d.ts';

export default class DataBase {
	// static DBName = 'searchFlats.db';
	static DBName = Deno.env.get('DATABASE_URL');
	static FlatsTable = 'flats';

	private db: sqlite.DB;
	private createOfferQuery?: sqlite.PreparedQuery<never, never, FlatsRow>;
  private updateOfferQuery?: sqlite.PreparedQuery<never, never, { id: string, wbs: boolean }>;
	private relevantOffersQuery?: sqlite.PreparedQuery<[string, string, number], never, { timestamp: number }>;

	constructor() {
		this.db = new sqlite.DB(DataBase.DBName);

		this.migrate();
		this.prepareQueries();
	}

	private migrate() {
		this.migrate_1();
	}

	private migrate_1() {
		this.db.execute(`
      CREATE TABLE IF NOT EXISTS ${DataBase.FlatsTable} (
        id UUID PRIMARY KEY  NOT NULL,
        company TEXT  NOT NULL,
        rent TEXT,
        size TEXT,
        rooms integer,
        wbs boolean,
        url varchar(255)  NOT NULL,
        created_at integer  NOT NULL,
        UNIQUE (url)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_${DataBase.FlatsTable}_url ON ${DataBase.FlatsTable} (url ASC);
    `);
	}

	private prepareQueries() {
		this.createOfferQuery = this.db.prepareQuery<never, never, FlatsRow>(`
      INSERT OR IGNORE INTO ${DataBase.FlatsTable} (
        id, company, rent, size, rooms, url, created_at
      ) VALUES (:id, :company, :rent, :size, :rooms, :url, :createdAt);
    `);

    this.updateOfferQuery = this.db.prepareQuery<never, never, { id: string, wbs: boolean }>(`
      UPDATE ${DataBase.FlatsTable}
      SET wbs = :wbs
      WHERE id = :id;
    `);

		this.relevantOffersQuery = this.db.prepareQuery<[string, string, number], never, { timestamp: number }>(`
      SELECT id, url, rooms FROM ${DataBase.FlatsTable}
      WHERE created_at >= :timestamp;
    `);
	}

	createOffer(company: string, offer: Offer) {
		const id = crypto.randomUUID();
		const createdAt = Date.now();
		const { rent, size, rooms, url } = offer;

		this.createOfferQuery?.execute({ id, company, rent, size, rooms, url, createdAt });
	}

  updateOffer(id: string, wbs: boolean) {
    this.updateOfferQuery?.execute({ id, wbs });
  }

	getRelevantOffers(timestamp: number): [string, string, number][] {
		return this.relevantOffersQuery?.all({ timestamp }) || [];
	}

	closeDb() {
		this.db.close();
	}
}
