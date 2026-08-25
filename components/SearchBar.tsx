"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { looksLikeAddress, looksLikeBlockHeight, looksLikeSignature } from "@/lib/format";
import { SearchIcon } from "./Icons";

/**
 * Routes a query by shape rather than asking the user what they pasted.
 * Rialo signatures are 64-byte base58 (87-88 chars) and addresses are 32-byte
 * base58 (43-44 chars), so the two never collide by length.
 */
function route(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  if (looksLikeBlockHeight(q)) return `/block/${q}`;
  if (looksLikeSignature(q)) return `/tx/${q}`;
  if (looksLikeAddress(q)) return `/address/${q}`;
  return null;
}

export function SearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const target = route(value);
    if (!target) {
      setError(value.trim() ? "Not a block height, signature, or address" : null);
      return;
    }
    setError(null);
    // Same host, so the search stays on the network the visitor is already on.
    router.push(target);
  }

  return (
    <form className="search" onSubmit={submit} role="search">
      <span className="search-icon">
        <SearchIcon />
      </span>
      <input
        className="search-input"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(null);
        }}
        placeholder="Block height, signature, or address"
        aria-label="Search Rialo"
        spellCheck={false}
        autoComplete="off"
      />
      {error ? <span className="search-error">{error}</span> : null}
    </form>
  );
}
