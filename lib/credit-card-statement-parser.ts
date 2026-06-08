import { isoToDate, toIsoDate } from "@/lib/date-picker";
import type { CreditCardCurrency } from "@/lib/credit-card-utils";
import { parseAmountInput } from "@/lib/amount-parser";

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
  let currentBlock: StatementBlock | null = null;

  const flushBlock = () => {
    if (!currentBlock) return;

    try {
      purchases.push(parseCreditCardStatementBlock(currentBlock));
    } catch (error) {
      errors.push(toParseError(error, currentBlock));
    }
    currentBlock = null;
  };

  text.split(/\r?\n/).forEach((sourceLine, index) => {
    const line = sourceLine.trim();
    const lineNumber = index + 1;
    if (!line) return;

    if (isStatementBlockStart(line)) {
      flushBlock();
      currentBlock = {
        startLineNumber: lineNumber,
        dateLine: line,
        lines: [],
      };
      return;
    }

    if (currentBlock) {
      if (isLegacyStatementLine(line)) {
        flushBlock();
      } else {
        currentBlock.lines.push({ lineNumber, sourceLine: line });
        return;
      }
    }

    try {
      purchases.push(parseCreditCardStatementLine(line));
    } catch (error) {
      errors.push({
        lineNumber,
        sourceLine: line,
        message:
          error instanceof Error ? error.message : "No se pudo interpretar.",
      });
    }
  });

  flushBlock();

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
  const amount = parseAmountInput(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor a cero.");
  }
  return amount;
}

type StatementBlockLine = {
  lineNumber: number;
  sourceLine: string;
};

type StatementBlock = {
  startLineNumber: number;
  dateLine: string;
  lines: StatementBlockLine[];
};

type ParsedBlockAmount = {
  lineNumber: number;
  sourceLine: string;
  amount: number;
  currency: CreditCardCurrency;
};

class CreditCardStatementBlockError extends Error {
  constructor(
    message: string,
    readonly lineNumber: number,
    readonly sourceLine: string
  ) {
    super(message);
  }
}

function parseCreditCardStatementBlock(
  block: StatementBlock
): ParsedCreditCardStatementPurchase {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(block.dateLine);
  if (!dateMatch) {
    throw new Error("La línea debe comenzar con una fecha DD/MM/YYYY.");
  }

  const purchaseDate = parseStatementDate(
    dateMatch[1],
    dateMatch[2],
    dateMatch[3]
  );
  const merchantLines: string[] = [];
  let amountLine: ParsedBlockAmount | null = null;
  let currentInstallment = 1;
  let installments = 1;

  for (const blockLine of block.lines) {
    const line = blockLine.sourceLine;
    const installmentMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(line);
    if (installmentMatch) {
      currentInstallment = Number(installmentMatch[1]);
      installments = Number(installmentMatch[2]);
    }

    const parsedAmount = parseBlockAmountLine(blockLine);
    if (parsedAmount) {
      amountLine = parsedAmount;
      continue;
    }

    if (isCardActivityLine(line)) continue;

    const merchantLine = line
      .replace(/\b\d{1,2}\/\d{1,2}\b/, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (merchantLine) {
      merchantLines.push(merchantLine);
    }
  }

  if (
    !Number.isInteger(currentInstallment) ||
    !Number.isInteger(installments) ||
    currentInstallment < 1 ||
    installments < 1 ||
    currentInstallment > installments
  ) {
    throw new CreditCardStatementBlockError(
      "La cantidad de cuotas no es válida.",
      block.startLineNumber,
      getBlockSourceLine(block)
    );
  }

  if (!amountLine) {
    throw new CreditCardStatementBlockError(
      "No se encontró el importe final.",
      block.startLineNumber,
      getBlockSourceLine(block)
    );
  }

  const name = merchantLines.join(" ").replace(/\s+/g, " ").trim();
  if (!name) {
    throw new CreditCardStatementBlockError(
      "No se encontró la descripción.",
      block.startLineNumber,
      getBlockSourceLine(block)
    );
  }

  return {
    sourceLine: getBlockSourceLine(block),
    purchaseDate,
    name,
    installmentAmount: amountLine.amount,
    totalAmount: Math.round(amountLine.amount * installments * 100) / 100,
    currency: amountLine.currency,
    installments,
    currentInstallment,
  };
}

function parseBlockAmountLine(
  blockLine: StatementBlockLine
): ParsedBlockAmount | null {
  const line = blockLine.sourceLine;
  if (!isBlockAmountLine(line)) return null;

  const amountText = line
    .replace(/\b(?:ARS|USD)\b/gi, " ")
    .replace(/\$/g, " ")
    .trim();
  const amount = parseAmountInput(amountText);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CreditCardStatementBlockError(
      "El importe debe ser mayor a cero.",
      blockLine.lineNumber,
      line
    );
  }

  return {
    lineNumber: blockLine.lineNumber,
    sourceLine: line,
    amount,
    currency: /\bUSD\b/i.test(line) ? "USD" : "ARS",
  };
}

function isStatementBlockStart(line: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(line);
}

function isLegacyStatementLine(line: string) {
  return /^\d{2}-\d{2}-(?:\d{2}|\d{4})\s+/.test(line);
}

function isCardActivityLine(line: string) {
  return /^(?:visa|mastercard|master|amex|american express)\s+\d{3,4}$/i.test(
    line
  );
}

function isBlockAmountLine(line: string) {
  return (
    /^\$\s*\S+/.test(line) ||
    /^(?:ARS|USD)\b\s+\S+/i.test(line) ||
    /^\S+\s+(?:ARS|USD)\b/i.test(line)
  );
}

function getBlockSourceLine(block: StatementBlock) {
  return [block.dateLine, ...block.lines.map((line) => line.sourceLine)]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toParseError(
  error: unknown,
  block: StatementBlock
): CreditCardStatementParseError {
  if (error instanceof CreditCardStatementBlockError) {
    return {
      lineNumber: error.lineNumber,
      sourceLine: error.sourceLine,
      message: error.message,
    };
  }

  return {
    lineNumber: block.startLineNumber,
    sourceLine: getBlockSourceLine(block),
    message: error instanceof Error ? error.message : "No se pudo interpretar.",
  };
}
