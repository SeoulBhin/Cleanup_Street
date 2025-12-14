// src/api/auth.js
import { getJSON } from "./http";
export const getMe = () => getJSON("/api/me");
