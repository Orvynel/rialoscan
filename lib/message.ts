/**
 * Message-level semantics for a Rialo transaction.
 *
 * Rialo inherits Solana's compact account-role encoding: roles are not stored
 * per account, they are implied by an account's *position* in `accountKeys`
 * combined with three counters in the header. Getting this wrong silently
 * mislabels which accounts a transaction could mutate, so it lives in one place.
 */

export type AccountRole = {
  index: number;
  address: string;
  signer: boolean;
  writable: boolean;
  feePayer: boolean;
  /** True when this index is referenced as a program by some instruction. */
  program: boolean;
};

export type MessageHeader = {
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
};

/**
 * `accountKeys` is ordered: writable signers, readonly signers, writable
 * non-signers, readonly non-signers. Given the three header counts, every
 * account's role is determined by its index.
 */
export function accountRoles(
  accountKeys: string[],
  header: MessageHeader,
  programIndexes: Iterable<number> = [],
): AccountRole[] {
  const total = accountKeys.length;
  const signers = header.numRequiredSignatures;
  const readonlySigners = header.numReadonlySignedAccounts;
  const readonlyUnsigned = header.numReadonlyUnsignedAccounts;
  const programs = new Set(programIndexes);

  return accountKeys.map((address, index) => {
    const signer = index < signers;
    const writable = signer ? index < signers - readonlySigners : index < total - readonlyUnsigned;
    return { index, address, signer, writable, feePayer: index === 0, program: programs.has(index) };
  });
}

export function roleLabel(role: AccountRole): string {
  const parts: string[] = [];
  if (role.feePayer) parts.push("fee payer");
  else if (role.signer) parts.push("signer");
  if (role.program) parts.push("program");
  parts.push(role.writable ? "writable" : "readonly");
  return parts.join(" · ");
}
