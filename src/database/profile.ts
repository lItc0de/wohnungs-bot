import { Client } from '../../deps.ts';
import { Profile } from '../definitions.d.ts';

export default class Profiles {
	private sql: Client;

	constructor(sql: Client) {
		this.sql = sql;
	}

	async getEnabledProfiles(): Promise<Profile[]> {
		const result = await this.sql.queryObject<Profile>`
      SELECT id, gender, name, surname, street, plz, city, email, phone, min_rooms as "minRooms", max_rooms as "maxRooms", wbs
      FROM profiles
      WHERE enabled IS TRUE
    `;

		return result.rows;
	}
}
