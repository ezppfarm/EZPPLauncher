import axios from "axios";
import type { Error } from "../types/error";
import type { User } from "../types/user";
import { ipcRenderer } from "electron";

const loginCheckEndpoint = "https://ez-pp.farm/login/check";
let retries = 0;

export const performLogin = async (
  username: string,
  password: string,
) => {
  const result = await ipcRenderer.invoke("ezpplauncher:login", {
    username,
    password,
  });
  console.log(result);
  return ({ code: 403, message: "Login failed." } as Error);
  /*   const result = await axios.post(loginCheckEndpoint, { username, password });
  const code = result.data.code ?? 404;
  if (code === 200 || code === 403) {
    retries = 0;
    return result.data.user as User;
  } else {
    if (retries++ >= 5) {
      return ({ code: 403, message: "Login failed." } as Error);
    }
    return await performLogin(username, password);
  } */
};
