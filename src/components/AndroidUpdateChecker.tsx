import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Smartphone } from "lucide-react";

declare global {
  interface Window {
    TigerNative?: { getAppVersion?: () => string };
  }
}

type ReleaseInfo = { name?: string; assets?: Array<{ name?: string; browser_download_url?: string }> };
const RELEASE_API = "https://api.github.com/repos/TigerChat-HQ/access-ace-friend/releases/tags/android-latest";

function compareVersions(a: string, b: string) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] || 0) - (right[i] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function AndroidUpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [status, setStatus] = useState("");
  const { toast } = useToast();

  const checkForUpdates = async () => {
    setChecking(true);
    setStatus("");
    try {
      const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? "APK ya sasa haijachapishwa bado." : "Imeshindikana kuangalia masasisho. Jaribu tena.");
      const release = (await response.json()) as ReleaseInfo;
      const apk = release.assets?.find((asset) => asset.name === "TigerChats.apk");
      if (!apk?.browser_download_url) throw new Error("APK haijapatikana kwenye release.");
      const version = release.name?.match(/v(\d+\.\d+\.\d+)/i)?.[1] || "";
      setLatestVersion(version);
      setDownloadUrl(apk.browser_download_url);
      const installed = window.TigerNative?.getAppVersion?.();
      if (installed && version) {
        setStatus(compareVersions(version, installed) > 0
          ? `Toleo jipya ${version} linapatikana. Toleo lako: ${installed}.`
          : `TIGERCHATS yako iko kwenye toleo la sasa (${installed}).`);
      } else {
        setStatus(version ? `Toleo la sasa linalopatikana ni ${version}.` : "APK ya sasa inapatikana kupakuliwa.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Jaribu tena baadaye.";
      setStatus(message);
      toast({ title: "Update check", description: message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const installedVersion = window.TigerNative?.getAppVersion?.();
  const updateAvailable = Boolean(downloadUrl && latestVersion && installedVersion && compareVersions(latestVersion, installedVersion) > 0);

  return (
    <div className="rounded-xl border border-border/60 bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Smartphone className="h-5 w-5 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Masasisho ya TIGERCHATS</p>
          <p className="text-xs text-muted-foreground">Angalia na pakua toleo jipya la Android.</p>
        </div>
      </div>
      {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={checkForUpdates} disabled={checking}>
          <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />{checking ? "Inaangalia..." : "Angalia masasisho"}
        </Button>
        {downloadUrl && (updateAvailable || !installedVersion) && (
          <Button asChild size="sm"><a href={downloadUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Pakua APK {latestVersion && `v${latestVersion}`}</a></Button>
        )}
      </div>
    </div>
  );
}
