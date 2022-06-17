/// <reference types="@sveltejs/kit" />

type Todo = {
	uid: string;
	createdAt: Date;
	text: string;
	done: boolean;
};
