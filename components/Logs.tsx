/**
 * Program log output, classified by line shape.
 *
 * Rialo emits Solana-style runtime logs (`Program <id> invoke [1]`, `Program log:
 * …`, `Program <id> success`). Colouring invoke/success/failure lines makes the
 * control flow of a transaction readable at a glance without parsing the log
 * into a tree — which would be guesswork, since inner instructions are returned
 * separately and are empty on devnet today.
 */
type Kind = "invoke" | "success" | "error" | "log";

function classify(line: string): Kind {
  if (/^Program \S+ (invoke|consumed)/.test(line)) return "invoke";
  if (/\bsuccess\b/.test(line)) return "success";
  if (/\bfailed\b|\berror\b|\bpanicked\b/i.test(line)) return "error";
  return "log";
}

export function Logs({ lines }: { lines: string[] }) {
  return (
    <ol className="logs">
      {lines.map((line, index) => (
        <li key={index} className="log-line" data-kind={classify(line)}>
          <span className="log-num">{index + 1}</span>
          <span className="log-body">{line}</span>
        </li>
      ))}
    </ol>
  );
}
