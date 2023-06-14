export type Offer = {
	rent: string | null;
	size: string | null;
	rooms: number;
	url: string;
};

export type FlatsRow = Offer & {
	id: string;
	company: string;
	createdAt: number;
}

export type Info = {
	gender: string;
	name: string;
	surname: string;
	street: string;
	plz: string;
	city: string;
	email: string;
	phone: string;
}

export type Search = {
	enabled: boolean;
	info: Info;
}

export type Config = {
	searches: Search[]
}
