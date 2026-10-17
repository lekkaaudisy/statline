// The developer test panel appears only when this is on AND the account is
// listed in the dev_testers table. The database checks the list again on
// every change, so the flag alone gives nobody extra powers.
export function devToolsFlagOn(): boolean {
  return process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
}
