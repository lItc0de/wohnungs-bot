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
