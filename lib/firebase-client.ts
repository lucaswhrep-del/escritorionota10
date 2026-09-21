"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { assertFirebaseConfig } from "./firebase";

const app = getApps().length ? getApp() : initializeApp(assertFirebaseConfig());
export const auth = getAuth(app);
