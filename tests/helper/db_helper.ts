import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import { Profile } from '../../src/definitions.d.ts';

const registerSignals = () => {
	Deno.addSignalListener('SIGINT', cleanup);
	Deno.addSignalListener('SIGTERM', cleanup);
};

const createDB = async (): Promise<void> => {
	const sql = new Client('postgres://test:test123@localhost:5432/postgres');
	await sql.connect();

	await sql.queryArray`
    DROP DATABASE IF EXISTS test;
  `;

	await sql.queryArray`
    CREATE DATABASE test;
  `;

	await sql.end();
};

export const profile: Profile = {
	id: crypto.randomUUID(),
	city: 'Berlin',
	email: 'name@example.com',
	gender: 'Frau',
	maxRooms: 4,
	minRooms: 2,
	name: 'name',
	phone: '+491439238572',
	plz: '12938',
	street: 'Berlinerstraße 27',
	surname: 'Dino',
	wbs: false,
};

export const profileWBS: Profile = {
	id: crypto.randomUUID(),
	city: 'Berlin',
	email: 'name@example.com',
	gender: 'Frau',
	maxRooms: 4,
	minRooms: 1,
	name: 'WBS',
	phone: '+491439238572',
	plz: '12938',
	street: 'Berlinerstraße 27',
	surname: 'Dino',
	wbs: true,
};

const populateDB = async (sql: Client, dbProfile: Profile): Promise<void> => {
	await sql.queryArray`
		INSERT INTO profiles (id, city, email, gender, max_rooms, min_rooms, name, phone, plz, street, surname, wbs, enabled)
		VALUES (${dbProfile.id}, ${dbProfile.city}, ${dbProfile.email}, ${dbProfile.gender}, ${dbProfile.maxRooms}, ${dbProfile.minRooms}, ${dbProfile.name}, ${dbProfile.phone}, ${dbProfile.plz}, ${dbProfile.street}, ${dbProfile.surname}, ${dbProfile.wbs}, true)
	`;
};

export const setup = async (dbProfile: Profile = profile): Promise<void> => {
	registerSignals();
	await createDB();

	const sql = new Client('postgres://test:test123@localhost:5432/test');
	await sql.connect();

	const transaction = sql.createTransaction('setup');
	await transaction.begin();

	// Timestamp function

	await transaction.queryArray /* sql */`
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  `;

	// Flats table

	await transaction.queryArray /* sql */`
  CREATE TABLE public.flats (
    id uuid NOT NULL,
    company varchar(50) NOT NULL,
    rent varchar(50) NULL,
    "size" varchar(50) NULL,
    rooms int4 NULL,
    wbs bool NULL,
    url varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    applied bool NULL DEFAULT false,
    is_new bool NOT NULL DEFAULT true,
    street varchar(100) NULL,
    district varchar(50) NULL,
    zip varchar(10) NULL,
    expose_url varchar(255) NULL,
    CONSTRAINT flats_pkey PRIMARY KEY (id),
    CONSTRAINT flats_url_key UNIQUE (url)
  );
  `;

	await transaction.queryArray /* sql */`
  CREATE UNIQUE INDEX idx_flats_url ON public.flats USING btree (url);
  `;

	await transaction.queryArray /* sql */`
  CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON flats
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();
  `;

	// Profiles table

	await transaction.queryArray /* sql */`
  CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY,
    enabled bool NOT NULL DEFAULT false,
    gender varchar(50) NOT NULL,
    "name" varchar(50) NOT NULL,
    surname varchar(50) NOT NULL,
    street varchar(50) NOT NULL,
    plz varchar(10) NOT NULL,
    city varchar(50) NOT NULL,
    email varchar(50) NOT NULL,
    phone varchar(50) NOT NULL,
    min_rooms int4 NOT NULL,
    max_rooms int4 NOT NULL,
    wbs bool NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  `;

	await transaction.queryArray /* sql */`
  create trigger set_timestamp before
  update
      on
      public.profiles for each row execute function trigger_set_timestamp();
  `;

	// FlatsProfiles table

	await transaction.queryArray /* sql */`
  CREATE TABLE public.flats_profiles (
    flat_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    CONSTRAINT flats_profiles_pk PRIMARY KEY (flat_id, profile_id),
    CONSTRAINT flats_profiles_fk FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT flats_profiles_fk_1 FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
  `;

	await transaction.commit();

  await populateDB(sql, dbProfile);

	await sql.end();
};

export const cleanup = async (): Promise<void> => {
	const sql = new Client('postgres://test:test123@localhost:5432/postgres');
	await sql.connect();

	await sql.queryArray`
    DROP DATABASE IF EXISTS test;
  `;

	await sql.end();

	Deno.removeSignalListener('SIGTERM', cleanup);
	Deno.removeSignalListener('SIGINT', cleanup);
};
