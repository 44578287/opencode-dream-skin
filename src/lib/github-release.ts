export const GITHUB_OWNER = "44578287";
export const GITHUB_REPO = "opencode-dream-skin";
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_ACTIONS_URL = `${GITHUB_URL}/actions`;
export const GITHUB_RELEASES_URL = `${GITHUB_URL}/releases`;

export type ApkRelease = {
  url: string;
  name: string;
  tag: string;
  page: string;
  sizeLabel: string;
};

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type GithubAsset = { name: string; browser_download_url: string; size: number };
type GithubRelease = {
  tag_name: string;
  html_url: string;
  assets?: GithubAsset[];
};

export async function fetchLatestApk(): Promise<ApkRelease | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=5`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) return null;
    const releases = (await res.json()) as GithubRelease[];
    for (const rel of releases) {
      const asset = (rel.assets ?? []).find((a) => a.name.toLowerCase().endsWith(".apk"));
      if (!asset) continue;
      return {
        url: asset.browser_download_url,
        name: asset.name,
        tag: rel.tag_name,
        page: rel.html_url,
        sizeLabel: formatSize(asset.size),
      };
    }
    return null;
  } catch {
    return null;
  }
}
