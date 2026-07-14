import { Landing } from "./routes/Landing";
import { Estate } from "./routes/Estate";
import { usePath } from "./router";
import { ESTATE_FUND_ADDRESS } from "./contract/config";

export default function App() {
  const path = usePath();

  if (ESTATE_FUND_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="center-note">
        <div className="card center-note-card">
          <p>
            No contract address configured. Set{" "}
            <code>VITE_CONTRACT_ADDRESS</code> after deploying EstateFund (see
            README).
          </p>
        </div>
      </div>
    );
  }

  const match = path.match(/^\/estate\/(\d+)\/?$/);
  if (match) return <Estate id={BigInt(match[1])} />;
  return <Landing />;
}
