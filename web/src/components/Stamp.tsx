import { explorerTx } from "../contract/config";

/** The brand's "in plain sight" rubber stamp, pressed onto executed expenses. */
export function HanKedereStamp({ txHash }: { txHash?: string }) {
  const stamp = (
    <span className="stamp" aria-label="Settled — verified onchain">
      <span className="stamp-main">HÁN KEDERE</span>
      <span className="stamp-sub">✓ IN PLAIN SIGHT</span>
    </span>
  );
  if (!txHash) return stamp;
  return (
    <a
      href={explorerTx(txHash)}
      target="_blank"
      rel="noreferrer"
      className="stamp-link"
      title="View the settling transaction on Monad explorer"
    >
      {stamp}
    </a>
  );
}
