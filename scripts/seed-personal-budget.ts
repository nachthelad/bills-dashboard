import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";

import { buildPersonalBudgetSeed } from "../lib/budget-profile-seed";

dotenv.config({ path: ".env.local" });
dotenv.config();

const emailArgIndex = process.argv.indexOf("--email");
const positionalEmail = process.argv
  .slice(2)
  .find((value) => value.includes("@"));
const email =
  (emailArgIndex >= 0 ? process.argv[emailArgIndex + 1]?.trim() : "") ||
  positionalEmail?.trim() ||
  "";
if (!email) {
  throw new Error(
    "Uso: npm run seed:personal-budget -- --email usuario@ejemplo.com"
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

const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  const user = await auth.getUserByEmail(email);
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const seed = buildPersonalBudgetSeed(user.uid, month);
  const batch = db.batch();
  const now = Timestamp.now();

  for (const item of seed.fixedExpenses) {
    batch.set(
      db.collection("fixedExpenses").doc(item.id),
      { ...item.data, createdAt: now, updatedAt: now },
      { merge: true }
    );
  }
  for (const item of seed.limits) {
    batch.set(
      db.collection("spendingLimits").doc(item.id),
      { ...item.data, updatedAt: now },
      { merge: true }
    );
  }
  for (const item of seed.incomeSources) {
    batch.set(
      db.collection("incomeSources").doc(item.id),
      { ...item.data, createdAt: now, updatedAt: now },
      { merge: true }
    );
  }
  batch.set(
    db.collection("budgetPreferences").doc(user.uid),
    {
      userId: user.uid,
      fundingMode: "cash",
      arsBufferAmount: 0,
      expectedIncome: 0,
      savingsMode: "percentage",
      savingsValue: 20,
      updatedAt: now,
    },
    { merge: true }
  );
  batch.set(
    db.collection("monthlyBudgets").doc(`${user.uid}_${month}`),
    {
      userId: user.uid,
      month,
      fundingMode: "cash",
      arsBufferAmount: 0,
      expectedIncome: 0,
      savingsMode: "percentage",
      savingsValue: 20,
      openingArsBalance: null,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  batch.set(
    db.collection("expenseSettings").doc(user.uid),
    {
      customCategories: FieldValue.arrayUnion(
        "Vivienda",
        "Impuestos",
        "Seguro"
      ),
    },
    { merge: true }
  );
  await batch.commit();

  const oldCategorySnapshot = await db
    .collection("dailyExpenses")
    .where("userId", "==", user.uid)
    .get();
  const toMigrate = oldCategorySnapshot.docs.filter(
    (doc) => doc.data().category === "Comida"
  );
  for (let index = 0; index < toMigrate.length; index += 450) {
    const migrationBatch = db.batch();
    for (const doc of toMigrate.slice(index, index + 450)) {
      migrationBatch.update(doc.ref, {
        category: "Comida comprada",
        updatedAt: now,
      });
    }
    await migrationBatch.commit();
  }

  console.log(
    `Presupuesto personal preparado para ${email}: ${seed.fixedExpenses.length} fijos, ${seed.limits.length} límites, ${seed.incomeSources.length} fuentes y ${toMigrate.length} movimientos migrados.`
  );
}

main().catch((error) => {
  console.error("No se pudo preparar el presupuesto personal", error);
  process.exitCode = 1;
});
