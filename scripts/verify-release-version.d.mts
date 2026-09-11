export interface ReleaseManifest {
  version: string;
}

export interface ReleaseLockfile {
  version?: string;
  packages?: {
    ""?: {
      version?: string;
    };
  };
}

export interface ReleaseVersionResult {
  version: string;
  stable: boolean;
}

export function compareSemVer(leftVersion: string, rightVersion: string): number;

export function verifyReleaseVersion(input: {
  manifest: ReleaseManifest;
  lockfile: ReleaseLockfile;
  tag?: string;
  previousTags?: string[];
}): ReleaseVersionResult;
