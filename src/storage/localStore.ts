import { type Writable, writable } from "svelte/store";
import { Page } from "../consts/pages";
import type { User } from "../types/user";

export const startup = writable(false);
export const launching = writable(false);
export const launchStatus = writable("Waiting...");
export const launchPercentage = writable(-1);
export const osuPath: Writable<undefined | string> = writable(undefined);
export const patch = writable(true);
export const currentUser: Writable<undefined | User> = writable(undefined);
export const currentPage = writable(Page.Login);
