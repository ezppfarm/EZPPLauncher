import axios from "axios";
import type { Error } from "../types/error";
import type { User } from "../types/user";

const loginCheckEndpoint = "https://ez-pp.farm/login/check";
let retries = 0;

export const performLogin = async (
  username: string,
  password: string,
): Promise<Error | User> => {
  const fetchResult = await fetch("https://ez-pp.farm/login/check", {
    method: "POST",
    mode: "cors",
    body: JSON.stringify({ username, password }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (fetchResult.ok) {
    const result = await fetchResult.json();
    retries = 0;
    return result.user;
  } else {
    if (retries++ >= 5) {
      console.log("Login failed after 5 retries.");
      retries = 0;
      return { code: 403, message: "Login failed." } as Error;
    }
    return await performLogin(username, password);
  }
};
