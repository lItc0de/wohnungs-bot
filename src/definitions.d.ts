export type Offer = {
	url: string;
	rooms: number;
	rent?: string | null;
	size?: string | null;
	wbs?: boolean | null;
	applied?: boolean | null;
	appliedFor?: string | null;
};

export type DBOffer = Offer & {
	id: string;
	company?: string;
}

export type Profile = {
	id: string;
	gender: 'Herr' | 'Frau';
	name: string;
	surname: string;
	street: string;
	plz: string;
	city: string;
	email: string;
	phone: string;
	minRooms: number;
	maxRooms: number;
	wbs: boolean;
}
