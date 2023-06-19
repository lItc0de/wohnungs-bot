import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

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

export const setup = async (withMigrate = true): Promise<void> => {
	registerSignals();
	await createDB();

	const sql = new Client('postgres://test:test123@localhost:5432/test');
	await sql.connect();

	const transaction = sql.createTransaction('setup');
	await transaction.begin();

	if (withMigrate) {
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
      applied BOOLEAN DEFAULT false,
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
	}

	await transaction.commit();

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
