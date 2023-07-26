### create trigger_set_timestamp function
```sql
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;
```


### create table flats
```sql
-- public.flats definition

-- Drop table

-- DROP TABLE public.flats;

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
	CONSTRAINT flats_pkey PRIMARY KEY (id),
	CONSTRAINT flats_url_key UNIQUE (url)
);
CREATE UNIQUE INDEX idx_flats_url ON public.flats USING btree (url);

-- Table Triggers

create trigger set_timestamp before
update
    on
    public.flats for each row execute function trigger_set_timestamp();
```


### create table profiles
```sql
-- public.profiles definition

-- Drop table

-- DROP TABLE public.profiles;

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

-- Table Triggers

create trigger set_timestamp before
update
    on
    public.profiles for each row execute function trigger_set_timestamp();
```

### create table flats_profiles
```sql
-- public.flats_profiles definition

-- Drop table

-- DROP TABLE public.flats_profiles;

CREATE TABLE public.flats_profiles (
	flat_id uuid NOT NULL,
	profile_id uuid NOT NULL,
	CONSTRAINT flats_profiles_pk PRIMARY KEY (flat_id, profile_id),
	CONSTRAINT flats_profiles_fk FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT flats_profiles_fk_1 FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);
```
