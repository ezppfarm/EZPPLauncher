import { type Writable, writable } from "svelte/store";
import { Page } from "../consts/pages";
import type { User } from "../types/user";

export const currentUser: Writable<undefined | User> = writable(undefined);
export const currentPage = writable(Page.Login);
