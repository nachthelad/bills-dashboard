import assert from "node:assert/strict";
import test from "node:test";

import {
  DocumentStatusError,
  normalizeLegacyDocumentStatus,
  parseDocumentProcessingStatus,
} from "../lib/server/document-status";

test("document writes accept processing states and reject paid", () => {
  assert.equal(parseDocumentProcessingStatus("parsed"), "parsed");
  assert.equal(parseDocumentProcessingStatus("needs_review"), "needs_review");
  assert.throws(
    () => parseDocumentProcessingStatus("paid"),
    DocumentStatusError
  );
});

test("legacy paid documents normalize idempotently to parsed", () => {
  assert.equal(normalizeLegacyDocumentStatus("paid"), "parsed");
  assert.equal(normalizeLegacyDocumentStatus("parsed"), "parsed");
  assert.equal(
    normalizeLegacyDocumentStatus(
      normalizeLegacyDocumentStatus("paid")
    ),
    "parsed"
  );
});
