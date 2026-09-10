import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus, RootsApi } from "../../packages/contracts";
import { providerMarks } from "./ProviderMarks";
export function ProviderConnections({api, onImport}: {api?: RootsApi; onImport?: (provider: "drive" | "gmail", ids: string[]) => Promise<boolean>}) {
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({drive: "", gmail: ""});
  const lock = useRef(false);
  const refresh = async () => {
    if (!api?.getConnections) { setLoading(false); return; }
    try { setConnections(await api.getConnections()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Connection status could not be checked."); setConnections([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); const focus = () => { void refresh(); }; window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus); }, [api]);
  const action = async (key: string, work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setPending(key); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Connection request failed."); }
    finally { lock.current = false; setPending(null); }
  };
  const update = (status: ConnectionStatus) => setConnections(old => [...old.filter(s => s.provider !== status.provider), status]);
  return <div className="provider-connections" aria-label="Family source connections">
    {(["drive", "gmail"] as const).map(provider => {
      const state = connections.find(c => c.provider === provider);
      // A server read receipt is required even if a stale payload says connected.
      const connected = state?.status === "connected" && !!state.verifiedAt && !!state.connectionId;
      const name = provider === "drive" ? "Google Drive" : "Gmail";
      return <article className="provider-card" key={provider}>
        <div className="provider-heading"><img src={providerMarks[provider]} alt="" width="32" height="32" /><strong>{name}</strong><span className={connected ? "connection-verified" : "muted"}>{loading ? "Checking…" : pending === provider ? "Connecting…" : connected ? "Connected" : state?.status === "expired" ? "Expired" : state?.status === "error" ? "Needs attention" : state?.status === "connecting" || state?.status === "connected" ? "Verification needed" : state ? "Not connected" : "Status unavailable"}</span></div>
        {state?.accountDisplay && <small>{state.accountDisplay}</small>}
        <div className="provider-actions">
          {!connected && <button type="button" disabled={!!pending || !state?.configured || !api?.connectProvider} onClick={() => void action(provider, async () => { const {url} = await api!.connectProvider!(provider); const target = new URL(url, window.location.origin); if (!['http:', 'https:'].includes(target.protocol)) throw new Error("Invalid connection destination."); window.open(target.href, "_blank", "noopener,noreferrer"); })}>{state?.status === "expired" ? "Reconnect" : "Connect"}</button>}
          <button type="button" disabled={!!pending || !api?.getConnections} onClick={() => void refresh()}>Refresh status</button>
        </div>
        <details><summary>Selected sources & connection details</summary>
          {!state?.configured && <p>Provider access is not configured. You can still select saved copies as files.</p>}
          {state?.verifiedAt && <p>Last successful check: {new Date(state.verifiedAt).toLocaleString("en-US")}</p>}
          {state?.error && <p className="error">{state.error}</p>}
          {!!state?.selectedScope.length && <p>Selected scope: {state.selectedScope.join(", ")}</p>}
          <label className="field">{provider === "drive" ? "Selected folder or file IDs" : "Selected message IDs"}<textarea value={selected[provider]} onChange={e => setSelected(s => ({...s, [provider]: e.target.value}))} placeholder="One source ID per line" rows={2} /></label>
          <div className="provider-actions"><button type="button" disabled={!!pending || !state?.configured || !api?.verifyConnection} onClick={() => void action(`verify-${provider}`, async () => update(await api!.verifyConnection!(provider, selected[provider].split(/[\n,]/).map(s => s.trim()).filter(Boolean))))}>Verify selected access</button>
          {connected && api?.disconnectProvider && <button type="button" disabled={!!pending} onClick={() => void action(`disconnect-${provider}`, async () => update(await api.disconnectProvider!(provider)))}>Disconnect</button>}
          {connected && onImport && <button type="button" disabled={!!pending || !selected[provider].trim()} onClick={() => void action(`import-${provider}`, async () => { await onImport(provider, selected[provider].split(/[\n,]/).map(s => s.trim()).filter(Boolean)); })}>Import selected sources</button>}</div>
        </details>
      </article>;
    })}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
