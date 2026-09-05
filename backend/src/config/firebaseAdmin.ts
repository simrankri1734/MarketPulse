import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

const getFirebaseAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Production / Render
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }

  // Local development
  const serviceAccountPath = path.resolve(
    process.cwd(),
    "serviceAccount.json"
  );

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8")
    );

    return initializeApp({
      credential: cert(serviceAccount),
    });
  }

  throw new Error(
    "Firebase Admin credentials are missing. Configure Firebase environment variables or provide serviceAccount.json for local development."
  );
};

const firebaseAdminApp = getFirebaseAdminApp();

export const adminAuth = getAuth(firebaseAdminApp);