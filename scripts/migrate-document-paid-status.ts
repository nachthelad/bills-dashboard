import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

import { normalizeLegacyDocumentStatus } from "../lib/server/document-status";

dotenv.config({ path: ".env.local" });
dotenv.config();

const positionalEmail = process.argv
  .slice(2)
  .find((value) => value.includes("@"));
if (!positionalEmail) {
  throw new Error(
    "Uso: npm run migrate:document-status -- usuario@ejemplo.com"
  );
}

const requiredEnv = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Faltan variables Firebase: ${missing.join(", ")}`);
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const user = await auth.getUserByEmail(positionalEmail);
  const snapshot = await db
    .collection("documents")
    .where("userId", "==", user.uid)
    .get();
  const legacy = snapshot.docs.filter(
    (doc) => normalizeLegacyDocumentStatus(doc.data().status) !== doc.data().status
  );

  for (let index = 0; index < legacy.length; index += 450) {
    const batch = db.batch();
    for (const document of legacy.slice(index, index + 450)) {
      batch.update(document.ref, {
        status: "parsed",
        updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();
  }

  console.log(
    `Estados de boletas migrados para ${positionalEmail}: ${legacy.length}`
  );
}

main().catch((error) => {
  console.error("No se pudieron migrar los estados de boletas", error);
  process.exitCode = 1;
});
