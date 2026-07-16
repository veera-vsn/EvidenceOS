"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { EntityBranchRow, EntityProfileRow } from "@/lib/supabase/database.types";

import { addBranch, removeBranch, saveEntityProfile } from "./actions";
import { ENTITY_TYPES } from "./entity-types";

interface EntityProfileFormProps {
  workspaceId: string;
  workspaceSlug: string;
  profile: EntityProfileRow | null;
  branches: EntityBranchRow[];
  canEdit: boolean;
}

const INPUT =
  "w-full rounded-[9px] border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent disabled:opacity-60";
const LABEL = "text-[13px] font-medium text-fg";

export function EntityProfileForm({
  workspaceId,
  workspaceSlug,
  profile,
  branches,
  canEdit,
}: EntityProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [lei, setLei] = useState(profile?.lei ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [entityType, setEntityType] = useState(profile?.entity_type ?? "");
  const [competentAuthority, setCompetentAuthority] = useState(
    profile?.competent_authority ?? "",
  );
  const [totalAssets, setTotalAssets] = useState(
    profile?.total_assets != null ? String(profile.total_assets) : "",
  );
  const [totalAssetsCurrency, setTotalAssetsCurrency] = useState(
    profile?.total_assets_currency ?? "",
  );

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEntityProfile(workspaceId, workspaceSlug, {
        lei,
        name,
        country,
        entityType,
        competentAuthority,
        totalAssets,
        totalAssetsCurrency,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-fg">B_01.01 — Entity identity</h2>
          {!canEdit && (
            <span className="font-mono text-[10.5px] text-fg-3">
              Read-only — owner/admin can edit
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>LEI</span>
            <input
              className={`${INPUT} font-mono`}
              value={lei}
              onChange={(e) => setLei(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="20-character Legal Entity Identifier"
              maxLength={20}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Legal name</span>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="Acme Payments Ltd"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Country</span>
            <input
              className={`${INPUT} font-mono uppercase`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="IE"
              maxLength={2}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Entity type</span>
            <select
              className={INPUT}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              disabled={!canEdit || isPending}
            >
              <option value="" disabled>
                Select…
              </option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={LABEL}>Competent authority</span>
            <input
              className={INPUT}
              value={competentAuthority}
              onChange={(e) => setCompetentAuthority(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="Central Bank of Ireland"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>
              Total assets <span className="font-normal text-fg-3">(optional, for B_01.02)</span>
            </span>
            <input
              className={INPUT}
              value={totalAssets}
              onChange={(e) => setTotalAssets(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="1000000"
              inputMode="decimal"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Currency</span>
            <input
              className={`${INPUT} font-mono uppercase`}
              value={totalAssetsCurrency}
              onChange={(e) => setTotalAssetsCurrency(e.target.value)}
              disabled={!canEdit || isPending}
              placeholder="EUR"
              maxLength={3}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded border border-danger bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="mt-4 text-[12.5px] text-success">✓ Saved</p>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="mt-4 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : profile ? "Save changes" : "Create entity profile"}
          </button>
        )}
      </section>

      <BranchList
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        branches={branches}
        canEdit={canEdit}
        hasProfile={profile !== null}
      />
    </div>
  );
}

function BranchList({
  workspaceId,
  workspaceSlug,
  branches,
  canEdit,
  hasProfile,
}: {
  workspaceId: string;
  workspaceSlug: string;
  branches: EntityBranchRow[];
  canEdit: boolean;
  hasProfile: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [branchCode, setBranchCode] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addBranch(workspaceId, workspaceSlug, { branchCode, name, country });
      if (result.error) {
        setError(result.error);
      } else {
        setBranchCode("");
        setName("");
        setCountry("");
        setAdding(false);
        router.refresh();
      }
    });
  }

  function handleRemove(branchId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeBranch(branchId, workspaceSlug);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-fg">B_01.03 — Branches</h2>
        <span className="text-xs text-fg-3">{branches.length} branch{branches.length !== 1 ? "es" : ""}</span>
      </div>

      {!hasProfile && (
        <p className="mb-3 text-[12.5px] text-fg-3">
          Save your entity identity above before adding branches.
        </p>
      )}

      {branches.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {branches.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-[9px] border border-border-2 bg-surface-2 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
                <span className="font-mono text-fg-3">{b.branch_code}</span>
                <span className="truncate font-medium text-fg">{b.name}</span>
                <span className="font-mono text-fg-3">{b.country}</span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(b.id)}
                  disabled={isPending}
                  className="flex-none rounded border border-border px-2 py-1 text-[11px] text-danger hover:bg-danger-soft disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded border border-danger bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      {canEdit && hasProfile && (
        adding ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_2fr_80px_auto]">
            <input
              className={INPUT}
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              placeholder="Branch code"
              disabled={isPending}
            />
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Branch name"
              disabled={isPending}
            />
            <input
              className={`${INPUT} font-mono uppercase`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="GB"
              maxLength={2}
              disabled={isPending}
            />
            <span className="flex gap-1.5">
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending}
                className="rounded-md bg-accent px-2.5 py-1.5 text-[12.5px] font-medium text-accent-fg disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={isPending}
                className="rounded-md border border-border px-2.5 py-1.5 text-[12.5px] text-fg"
              >
                Cancel
              </button>
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-[9px] border border-border px-3.5 py-2 text-[13px] font-medium text-fg hover:bg-surface-2"
          >
            + Add branch
          </button>
        )
      )}
    </section>
  );
}
