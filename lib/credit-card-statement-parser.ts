import { isoToDate, toIsoDate } from "@/lib/date-picker";
import type { CreditCardCurrency } from "@/lib/credit-card-utils";

export type ParsedCreditCardStatementPurchase = {
  sourceLine: string;
  purchaseDate: string;
  name: string;
  installmentAmount: number;
  totalAmount: number;
  currency: CreditCardCurrency;
  installments: number;
  currentInstallment: number;
};

export type CreditCardStatementParseError = {
  lineNumber: number;
  sourceLine: string;
  message: string;
};

export function parseCreditCardStatement(text: string) {
  const purchases: ParsedCreditCardStatementPurchase[] = [];
  const errors: CreditCardStatementParseError[] = [];

  text.split(/\r?\n/).forEach((sourceLine, index) => {
    const line = sourceLine.trim();
    if (!line) return;

    try {
      purchases.push(parseCreditCardStatementLine(line));
    } catch (error) {
      errors.push({
        lineNumber: index + 1,
        sourceLine: line,
        message:
          error instanceof Error ? error.message : "No se pudo interpretar.",
      });
    }
  });

  return { purchases, errors };
}

export function parseCreditCardStatementLine(
  sourceLine: string
): ParsedCreditCardStatementPurchase {
  const dateMatch = /^(\d{2})-(\d{2})-(\d{2}|\d{4})\s+(.+)$/.exec(sourceLine);
  if (!dateMatch) {
    throw new Error("La línea debe comenzar con una fecha DD-MM-AA.");
  }

  const purchaseDate = parseStatementDate(
    dateMatch[1],
    dateMatch[2],
    dateMatch[3]
  );
  let remainder = dateMatch[4].trim();
  const amountMatch = /(\d+(?:\.\d{3})*,\d{2})$/.exec(remainder);
  if (!amountMatch) {
    throw new Error("No se encontró el importe final.");
  }

  const installmentAmount = parseArgentineAmount(amountMatch[1]);
  remainder = remainder.slice(0, amountMatch.index).trim();

  const currency: CreditCardCurrency = /\bUSD\b/i.test(remainder)
    ? "USD"
    : "ARS";
  const installmentMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(remainder);
  const currentInstallment = installmentMatch
    ? Number(installmentMatch[1])
    : 1;
  const installments = installmentMatch ? Number(installmentMatch[2]) : 1;
  if (
    !Number.isInteger(currentInstallment) ||
    !Number.isInteger(installments) ||
    currentInstallment < 1 ||
    installments < 1 ||
    currentInstallment > installments
  ) {
    throw new Error("La cantidad de cuotas no es válida.");
  }

  remainder = remainder
    .replace(/\b\d{1,2}\/\d{1,2}\b/, " ")
    .replace(/\s+\d{5,}\s*$/, " ")
    .replace(/\bUSD\s+\d+(?:\.\d{3})*,\d{2}\b/i, " ")
    .replace(/^\s*(?:K|\*)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!remainder) {
    throw new Error("No se encontró la descripción.");
  }

  return {
    sourceLine,
    purchaseDate,
    name: remainder,
    installmentAmount,
    totalAmount: Math.round(installmentAmount * installments * 100) / 100,
    currency,
    installments,
    currentInstallment,
  };
}

function parseStatementDate(day: string, month: string, year: string) {
  const fullYear = year.length === 2 ? `20${year}` : year;
  const isoDate = `${fullYear}-${month}-${day}`;
  const date = isoToDate(isoDate);
  if (!date || toIsoDate(date) !== isoDate) {
    throw new Error("La fecha no es válida.");
  }
  return isoDate;
}

function parseArgentineAmount(value: string) {
  const amount = Number(value.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor a cero.");
  }
  return amount;
}
