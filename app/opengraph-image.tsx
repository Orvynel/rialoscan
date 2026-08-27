import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { requestHost, requestNetwork } from "@/lib/host";
import { NETWORK_IDS, NETWORKS, originFor } from "@/lib/networks";

/**
 * The card link previews show, on X, Discord, Slack and anywhere else that reads
 * OpenGraph. Per-host like the rest of the metadata: a card claiming both
 * networks would be wrong on both hosts.
 *
 * Nothing here is a live number. A crawler caches this image for days, so a block
 * height baked into it would be presented as current long after it stopped being
 * true — and generating it would put an RPC round trip inside a response that
 * crawlers abandon if it is slow. Everything on the card stays true indefinitely:
 * what the explorer covers, which host serves it, and which node it reads.
 */
export const alt = "RialoScan — block explorer for the Rialo network";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Literals rather than the CSS custom properties, since this renders outside the
// document and the dark palette is the brand either way.
const BG = "#010101";
const TEXT = "#e8e3d5";
const ACCENT = "#a9ddd3";
const MUTED = "rgba(232, 227, 213, 0.62)";
const DIM = "rgba(232, 227, 213, 0.38)";
const RULE = "rgba(232, 227, 213, 0.1)";

const COVERS = "Blocks · Transactions · Accounts · Validators · REX";

export default async function OpenGraphImage() {
  const [{ host, protocol }, net] = await Promise.all([requestHost(), requestNetwork()]);
  const network = net === null ? null : NETWORKS[net];

  // `new URL(..., import.meta.url)` is the form the bundler recognises as an asset
  // reference, so the font is traced into the deployment rather than left behind as
  // a path that only resolves locally. It has to be read rather than fetched:
  // `fetch` on the Node runtime does not implement `file:`.
  const geistMono = await readFile(new URL("./og/GeistMono-Regular.ttf", import.meta.url));

  const bare = (url: string) => url.replace(/^https?:\/\//, "");

  const headline = network === null ? "Rialo Block Explorer" : `Rialo ${network.label}`;
  const aside =
    network === null
      ? NETWORK_IDS.map((id) => bare(originFor(id, host, protocol))).join("   ·   ")
      : `reads ${bare(network.rpc)} over JSON-RPC`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          background: BG,
          backgroundImage: `linear-gradient(150deg, rgba(169, 221, 211, 0.08), rgba(1, 1, 1, 0) 45%)`,
          color: TEXT,
          fontFamily: "Geist Mono",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="42" height="42" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.4 1.2 13.4h13.6L8 1.4Z"
              stroke={ACCENT}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d="M4.6 9.2h6.8" stroke={ACCENT} strokeWidth="1.1" strokeOpacity="0.55" />
            <path d="M6.2 6.4h3.6" stroke={ACCENT} strokeWidth="1.1" strokeOpacity="0.3" />
          </svg>
          <div style={{ fontSize: 30, letterSpacing: 4, color: TEXT }}>RIALOSCAN</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, letterSpacing: -2, lineHeight: 1 }}>{headline}</div>
          <div style={{ fontSize: 26, color: MUTED }}>{COVERS}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 40,
            paddingTop: 26,
            borderTop: `1px solid ${RULE}`,
          }}
        >
          <div style={{ fontSize: 26, color: ACCENT }}>{host}</div>
          <div style={{ fontSize: 22, color: DIM }}>{aside}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Geist Mono", data: geistMono, weight: 400, style: "normal" }],
    },
  );
}
