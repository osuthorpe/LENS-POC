'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  CalendarDays,
  CircleHelp,
  Clock3,
  Database,
  FileText,
  FileSearch,
  ExternalLink,
  LoaderCircle,
  MessageSquareText,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  extractClaimValues,
  relevantSourceExcerpt,
  sourceSupportsValue,
} from '@/lib/evidence-detail';
import { fallbackBrief, fallbackCompanies } from '@/lib/fallback-data';
import type {
  BriefItem,
  BriefResult,
  ClaimCitation,
  ClaimValue,
  Company,
  EvidenceState,
  RelationshipStatus,
  SourceReference,
  SourceDetail,
} from '@/lib/types';

const sourceIcon = {
  crm: Database,
  meeting: FileText,
  slack: MessageSquareText,
  news: Newspaper,
};

const stateStyle: Record<EvidenceState, string> = {
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  conflict: 'border-amber-200 bg-amber-50 text-amber-800',
  stale: 'border-orange-200 bg-orange-50 text-orange-800',
  missing: 'border-slate-200 bg-slate-50 text-slate-700',
  unverified: 'border-rose-200 bg-rose-50 text-rose-800',
};

const stateIconStyle: Record<EvidenceState, string> = {
  confirmed: 'text-emerald-600',
  conflict: 'text-amber-600',
  stale: 'text-orange-600',
  missing: 'text-slate-500',
  unverified: 'text-rose-600',
};

function formatDate(value: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function sourceLabel(type: SourceReference['sourceType']) {
  if (type === 'crm') return 'CRM';
  if (type === 'slack') return 'Slack';
  return type[0].toUpperCase() + type.slice(1);
}

function stateLabel(state: EvidenceState) {
  if (state === 'conflict') return 'Values differ';
  if (state === 'stale') return 'Earlier data';
  if (state === 'missing') return 'Missing data';
  if (state === 'unverified') return 'Not confirmed';
  return 'Confirmed';
}

function stateGuidance(state: EvidenceState) {
  if (state === 'conflict') return 'Compare the dated values before you use this fact.';
  if (state === 'stale') return 'Use the newest dated value. AVIC keeps the earlier value as source history.';
  if (state === 'missing') return 'Ask for this missing information.';
  if (state === 'unverified') return 'Confirm this statement before you use it.';
  return null;
}

function kindLabel(kind: BriefItem['kind']) {
  if (kind === 'fact') return 'Source fact';
  if (kind === 'analysis') return 'Generated analysis';
  return 'Question';
}

function evidenceHeading(kind: BriefItem['kind']) {
  if (kind === 'fact') return 'Evidence for this fact';
  if (kind === 'analysis') return 'Evidence used for this analysis';
  return 'Evidence that caused this question';
}

function valueKindLabel(value: ClaimValue) {
  if (value.kind === 'money') return 'Money';
  if (value.kind === 'percent') return 'Percent';
  if (value.kind === 'duration') return 'Time';
  if (value.kind === 'date') return 'Date';
  return 'Count';
}

function citationRoleLabel(role: ClaimCitation['role']) {
  if (role === 'supports') return 'Supports';
  if (role === 'earlier') return 'Earlier value';
  return 'Context';
}

function citationRoleStyle(role: ClaimCitation['role']) {
  if (role === 'supports') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (role === 'earlier') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-stone-200 bg-stone-50 text-slate-600';
}

function humanizeField(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayRawValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not specified';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function externalSourceUrl(locator: string) {
  try {
    const url = new URL(locator);
    if (url.protocol !== 'https:' || url.hostname.endsWith('.example')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function HighlightedText({ text, values }: { text: string; values: ClaimValue[] }) {
  if (!values.length) return <>{text}</>;
  const terms = values
    .map((value) => value.value)
    .sort((left, right) => right.length - left.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${terms.join('|')})`, 'gi'));
  const normalized = new Set(values.map((value) => value.value.toLowerCase()));
  return (
    <>
      {parts.map((part, index) =>
        normalized.has(part.toLowerCase()) ? (
          <mark className="rounded bg-amber-100 px-0.5 text-inherit" key={`${part}-${index}`}>
            {part}
          </mark>
        ) : part,
      )}
    </>
  );
}

async function fetchBrief(companyId: string) {
  const response = await fetch('/api/briefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  });
  if (!response.ok) throw new Error('Brief generation failed.');
  return response.json() as Promise<BriefResult>;
}

function CompanyList({
  companies,
  activeId,
  loadingId,
  onSelect,
}: {
  companies: Company[];
  activeId: string;
  loadingId: string | null;
  onSelect: (company: Company) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<RelationshipStatus>('portfolio');
  const filtered = companies.filter((company) =>
    `${company.name} ${company.sector}`.toLowerCase().includes(query.toLowerCase()),
  );
  const visibleCompanies = filtered.filter(
    (company) => company.relationshipStatus === group,
  );
  const groupCount = (status: RelationshipStatus) =>
    companies.filter((company) => company.relationshipStatus === status).length;
  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) return;
    const matches = companies.filter((company) =>
      `${company.name} ${company.sector}`.toLowerCase().includes(value.toLowerCase()),
    );
    if (!matches.some((company) => company.relationshipStatus === group)) {
      const nextGroup = matches[0]?.relationshipStatus;
      if (nextGroup) setGroup(nextGroup);
    }
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-stone-200/80 bg-[#f6f3ed]/95 lg:flex">
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-stone-200/80 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#18345c] text-xs font-bold tracking-tight text-white shadow-sm">
          AI
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">AIVC</p>
          <p className="text-[11px] text-slate-500">Company intelligence</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-3.5">
        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Search companies"
            className="h-9 rounded-xl border-stone-200 bg-white pl-9 text-sm shadow-none"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Find company"
            value={query}
          />
        </div>

        <div
          aria-label="Company group"
          className="grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-stone-200/60 p-1"
          role="tablist"
        >
          {(['portfolio', 'pipeline'] as const).map((status) => {
            const active = group === status;
            return (
              <button
                aria-selected={active}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#18345c] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
                }`}
                key={status}
                onClick={() => setGroup(status)}
                role="tab"
                type="button"
              >
                <span>{status === 'portfolio' ? 'Portfolio' : 'Pipeline'}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active ? 'bg-white/15 text-white' : 'bg-stone-300/70 text-slate-500'
                  }`}
                >
                  {groupCount(status)}
                </span>
              </button>
            );
          })}
        </div>

        <div
          aria-label={`${group} companies`}
          className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5"
          role="tabpanel"
        >
          {visibleCompanies.map((company) => {
            const active = company.id === activeId;
            return (
              <button
                aria-current={active ? 'true' : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                  active
                    ? 'border-blue-200 bg-white shadow-[0_4px_16px_rgb(42_70_110/8%)]'
                    : 'border-transparent hover:border-stone-200 hover:bg-white/70'
                }`}
                key={company.id}
                onClick={() => onSelect(company)}
                type="button"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold ${
                    active
                      ? 'bg-[#dce9ff] text-[#26599e]'
                      : 'bg-stone-200/80 text-stone-600'
                  }`}
                >
                  {company.name
                    .split(' ')
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-800">
                    {company.name}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {group === 'portfolio' ? company.companyStage : company.pipelineStage}
                  </span>
                </span>
                {loadingId === company.id ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-600" />
                ) : active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                ) : null}
              </button>
            );
          })}
          {visibleCompanies.length === 0 && (
            <p className="px-3 py-5 text-center text-xs text-slate-500">
              No companies found.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function EvidenceItem({
  item,
  sources,
  expanded,
  onToggle,
  onOpenSource,
}: {
  item: BriefItem;
  sources: SourceReference[];
  expanded: boolean;
  onToggle: () => void;
  onOpenSource: (source: SourceReference, item: BriefItem) => void;
}) {
  const StateIcon =
    item.state === 'conflict'
      ? TriangleAlert
      : item.state === 'stale'
        ? Clock3
        : item.state === 'missing'
          ? CircleHelp
          : item.state === 'unverified'
            ? ShieldAlert
            : null;
  const itemSources = item.sourceIds
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is SourceReference => Boolean(source));
  const values = item.values ?? extractClaimValues(item.text);
  const citations = item.citations ?? itemSources.map((source): ClaimCitation => ({
    sourceId: source.id,
    role: item.kind === 'fact'
      ? (
          /superseded|old/i.test(source.verificationStatus ?? '') || (
            (item.state === 'conflict' || item.state === 'stale') &&
            Boolean(values[0]) &&
            !sourceSupportsValue(values[0]!, source.content) &&
            values.some((value) => sourceSupportsValue(value, source.content))
          )
            ? 'earlier'
            : 'supports'
        )
      : 'context',
    excerpt: relevantSourceExcerpt(source.content, item.text),
    values: values.filter((value) => sourceSupportsValue(value, source.content)),
  }));
  const latestLabel = item.sourceDate ? formatDate(item.sourceDate) : 'No source date';
  const evidenceLabel = itemSources.length === 1
    ? `Evidence · ${sourceLabel(itemSources[0].sourceType)} · ${latestLabel}`
    : `Evidence · ${itemSources.length} sources · latest ${latestLabel}`;
  const evidenceName = itemSources.length === 1
    ? sourceLabel(itemSources[0].sourceType)
    : `${itemSources.length} sources`;
  const showLabels = item.kind === 'analysis' || item.state !== 'confirmed';
  const panelId = `evidence-${item.id}`;
  return (
    <div className="border-b border-stone-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="grid grid-cols-[minmax(0,1fr)_112px] items-start gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_148px]">
        <div className="min-w-0 self-center">
          {showLabels && (
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {StateIcon && <StateIcon className={`h-4 w-4 shrink-0 ${stateIconStyle[item.state]}`} />}
              {item.kind === 'analysis' && (
                <Badge className="h-5 rounded-md border-blue-200 bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-800" variant="outline">
                  Analysis
                </Badge>
              )}
              {item.state !== 'confirmed' && (
                <Badge
                  className={`h-5 rounded-md px-1.5 text-[10px] font-semibold ${stateStyle[item.state]}`}
                  variant="outline"
                >
                  {stateLabel(item.state)}
                </Badge>
              )}
            </div>
          )}
          <p className="text-[13px] leading-5 text-slate-700">{item.text}</p>
        </div>

        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          aria-label={evidenceLabel}
          className={`flex min-h-11 w-full items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:gap-2 sm:px-2.5 ${
            expanded
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-stone-200 bg-stone-50/70 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
          }`}
          id={`${panelId}-trigger`}
          onClick={onToggle}
          type="button"
        >
          <FileSearch className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold leading-4">{evidenceName}</span>
            {item.sourceDate ? (
              <time className="block truncate text-[11px] font-medium leading-4 opacity-75" dateTime={item.sourceDate}>
                {latestLabel}
              </time>
            ) : (
              <span className="block truncate text-[11px] font-medium leading-4 opacity-75">{latestLabel}</span>
            )}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <section
            aria-labelledby={`${panelId}-trigger`}
            className="col-span-2 mt-1 rounded-xl border border-blue-100 bg-[#f7faff] p-3 sm:p-4"
            id={panelId}
            role="region"
          >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{evidenceHeading(item.kind)}</p>
                <Badge className="bg-white text-[10px] text-slate-600" variant="outline">
                  {kindLabel(item.kind)}
                </Badge>
              </div>

              {stateGuidance(item.state) && (
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-slate-700">
                  {stateGuidance(item.state)}
                </p>
              )}

              {values.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-slate-500">Values in this statement</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {values.map((value) => {
                      const matchingSources = itemSources.filter((source) =>
                        sourceSupportsValue(value, source.content),
                      );
                      return (
                        <div className="rounded-lg border border-stone-200 bg-white p-2.5" key={`${value.kind}-${value.value}`}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">{value.value}</span>
                            <span className="text-[10px] text-slate-500">{valueKindLabel(value)}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="w-full text-[10px] text-slate-500">
                              {matchingSources.length} {matchingSources.length === 1 ? 'source mentions' : 'sources mention'} this value.
                            </span>
                            {matchingSources.map((source) => (
                              <button
                                className="min-h-8 rounded-md bg-stone-100 px-2 text-[10px] font-medium text-slate-600 transition hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                key={source.id}
                                onClick={() => onOpenSource(source, item)}
                                type="button"
                              >
                                {sourceLabel(source.sourceType)} · {formatDate(source.sourceDate)}
                              </button>
                            ))}
                            {matchingSources.length === 0 && (
                              <span className="text-[10px] text-slate-500">See the source context below.</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {itemSources.map((source) => {
                  const Icon = sourceIcon[source.sourceType];
                  const citation = citations.find((entry) => entry.sourceId === source.id);
                  const role = citation?.role ?? 'context';
                  return (
                    <article className="rounded-lg border border-stone-200 bg-white p-3" key={source.id}>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-slate-600">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{source.title}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {sourceLabel(source.sourceType)} · <time dateTime={source.sourceDate}>{formatDate(source.sourceDate)}</time>
                              </p>
                            </div>
                            <Badge className={`text-[10px] ${citationRoleStyle(role)}`} variant="outline">
                              {citationRoleLabel(role)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            <HighlightedText text={citation?.excerpt ?? relevantSourceExcerpt(source.content, item.text)} values={values} />
                          </p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500">
                              {source.verificationStatus
                                ? humanizeField(source.verificationStatus)
                                : 'Verification is not specified'}
                            </span>
                            <button
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                              onClick={() => onOpenSource(source, item)}
                              type="button"
                            >
                              Open source <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
          </section>
        )}
      </div>
    </div>
  );
}

function EvidenceSection({
  title,
  items,
  sources,
  expandedItemId,
  onToggleItem,
  onOpenSource,
}: {
  title: string;
  items: BriefItem[];
  sources: SourceReference[];
  expandedItemId: string | null;
  onToggleItem: (itemId: string) => void;
  onOpenSource: (source: SourceReference, item: BriefItem) => void;
}) {
  return (
    <Card className="border-stone-200/90 bg-white/95 shadow-[0_8px_28px_rgb(34_53_80/4%)]" size="sm">
      <CardHeader className="pb-1.5">
        <h2 className="font-display text-xl font-normal tracking-tight text-slate-900">
          {title}
        </h2>
      </CardHeader>
      <CardContent>
        {items.map((item) => (
          <EvidenceItem
            expanded={expandedItemId === item.id}
            item={item}
            key={item.id}
            onOpenSource={onOpenSource}
            onToggle={() => onToggleItem(item.id)}
            sources={sources}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <Card className="border-stone-200 bg-white/90" key={item}>
          <CardHeader><Skeleton className="h-6 w-36" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-7 w-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CoveragePanel({ brief }: { brief: BriefResult }) {
  const total = brief.coverage.reduce((sum, item) => sum + item.count, 0);
  return (
    <aside className="xl:sticky xl:top-20 xl:self-start">
      <Card className="border-stone-200/90 bg-white/95 shadow-[0_8px_28px_rgb(34_53_80/4%)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <CardTitle className="text-sm">Sources</CardTitle>
            </div>
            <Badge
              className="border-blue-200 bg-blue-50 text-[10px] text-blue-800"
              variant="outline"
            >
              Selected company
            </Badge>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {total} imported records · newest {formatDate(brief.company.latestSourceDate)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            {brief.coverage.map((item) => (
              <div
                className="flex items-center justify-between rounded-lg bg-stone-50 px-2.5 py-2 text-xs"
                key={item.category}
              >
                <span className="text-slate-600">{item.category}</span>
                <span className="font-semibold tabular-nums text-slate-800">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>(fallbackCompanies);
  const [brief, setBrief] = useState<BriefResult>(fallbackBrief);
  const [selected, setSelected] = useState<Company>(fallbackCompanies[0]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<SourceReference | null>(null);
  const [sourceParentItem, setSourceParentItem] = useState<BriefItem | null>(null);
  const [sourceDetail, setSourceDetail] = useState<SourceDetail | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ready' | 'offline' | 'error'>('offline');
  const requestId = useRef(0);
  const sourceCache = useRef(new Map<string, SourceDetail>());
  const briefMatchesSelection = brief.company.id === selected.id;
  const conflictCount = useMemo(
    () =>
      briefMatchesSelection
        ? [...brief.currentState, ...brief.changes, ...brief.risks].filter(
            (item) => item.state === 'conflict',
          ).length
        : 0,
    [brief, briefMatchesSelection],
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      try {
        const response = await fetch('/api/companies');
        if (!response.ok) throw new Error('The database is not ready.');
        const data = (await response.json()) as { companies: Company[] };
        if (!data.companies.length || !active || currentRequest !== requestId.current) return;
        const first =
          data.companies.find((company) => company.id === 'cmp_vectorforge') ??
          data.companies[0];
        if (!first) return;
        setCompanies(data.companies);
        setSelected(first);
        const nextBrief = await fetchBrief(first.id);
        if (!active || currentRequest !== requestId.current) return;
        setBrief(nextBrief);
        setStatus('ready');
      } catch {
        if (active && currentRequest === requestId.current) setStatus('offline');
      } finally {
        if (active && currentRequest === requestId.current) setLoading(false);
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!openSource) return;
    const cacheKey = `${selected.id}:${openSource.id}`;
    if (sourceCache.current.has(cacheKey)) return;

    const controller = new AbortController();
    fetch(`/api/sources/${encodeURIComponent(openSource.id)}?companyId=${encodeURIComponent(selected.id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('The full source record is not available.');
        return response.json() as Promise<{ source: SourceDetail }>;
      })
      .then((data) => {
        if (data.source.companyId !== selected.id) {
          throw new Error('The source belongs to a different company.');
        }
        sourceCache.current.set(cacheKey, data.source);
        setSourceDetail(data.source);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSourceError(error instanceof Error ? error.message : 'The full source record is not available.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSourceLoading(false);
      });

    return () => controller.abort();
  }, [openSource, selected.id]);

  async function generateBrief(company = selected) {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setExpandedItemId(null);
    closeSource();
    setSelected(company);
    setLoading(true);
    try {
      const nextBrief = await fetchBrief(company.id);
      if (currentRequest !== requestId.current) return;
      setBrief(nextBrief);
      setStatus('ready');
    } catch {
      if (currentRequest !== requestId.current) return;
      setStatus('error');
      if (company.id === 'cmp_vectorforge') setBrief(fallbackBrief);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  const showBrief = !loading && briefMatchesSelection;
  const dataWarning = status !== 'ready';
  const sourceValues = sourceParentItem?.values ??
    (sourceParentItem ? extractClaimValues(sourceParentItem.text) : []);
  const sourceContent = sourceDetail?.normalizedContent ?? openSource?.content ?? '';
  const originalUrl = openSource ? externalSourceUrl(openSource.locator) : null;

  function toggleEvidence(itemId: string) {
    setExpandedItemId((current) => current === itemId ? null : itemId);
  }

  function openFullSource(source: SourceReference, item: BriefItem) {
    const cached = sourceCache.current.get(`${selected.id}:${source.id}`) ?? null;
    setSourceDetail(cached);
    setSourceError(null);
    setSourceLoading(!cached);
    setSourceParentItem(item);
    setOpenSource(source);
  }

  function closeSource() {
    setOpenSource(null);
    setSourceParentItem(null);
    setSourceDetail(null);
    setSourceError(null);
    setSourceLoading(false);
  }

  return (
    <main className="min-h-screen text-slate-900">
      <CompanyList
        activeId={selected.id}
        companies={companies}
        loadingId={loading ? selected.id : null}
        onSelect={generateBrief}
      />

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-stone-200/80 bg-[#fbfaf7]/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold text-slate-500">
              Current brief
            </p>
            {showBrief && (
              <p className="mt-0.5 text-xs text-slate-500">
                Prepared {formatDate(brief.generatedAt)}
              </p>
            )}
          </div>
          <label className="min-w-0 flex-1 lg:hidden">
            <span className="sr-only">Company</span>
            <select
              aria-label="Company"
              className="h-9 w-full max-w-[260px] truncate rounded-lg border border-stone-200 bg-white px-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              disabled={loading}
              onChange={(event) => {
                const company = companies.find((item) => item.id === event.target.value);
                if (company) generateBrief(company);
              }}
              value={selected.id}
            >
              <optgroup label="Portfolio">
                {companies.filter((company) => company.relationshipStatus === 'portfolio').map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </optgroup>
              <optgroup label="Pipeline">
                {companies.filter((company) => company.relationshipStatus === 'pipeline').map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <Button
            className="h-8 bg-[#315f9f] px-3 shadow-sm hover:bg-[#244e87]"
            disabled={loading}
            onClick={() => generateBrief()}
            size="sm"
          >
            {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            <span className="hidden sm:inline">{loading ? 'Preparing' : 'Refresh brief'}</span>
            <span className="sm:hidden">{loading ? 'Preparing' : 'Refresh'}</span>
          </Button>
        </header>

        <div className="min-h-[calc(100vh-60px)] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-[1180px]">
            <section className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-[#e0eaff] px-2.5 text-[#28538e] hover:bg-[#e0eaff]">
                  {selected.relationshipStatus === 'portfolio' ? 'Portfolio' : 'Pipeline'}
                </Badge>
                <Badge className="rounded-full bg-white/70 text-slate-600" variant="outline">
                  {selected.companyStage}
                </Badge>
                {selected.pipelineStage && (
                  <Badge className="rounded-full bg-white/70 text-slate-600" variant="outline">
                    {selected.pipelineStage}
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-[38px] leading-none tracking-[-0.03em] text-[#162d4e] sm:text-[44px]">
                {selected.name}
              </h1>
              <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
                {selected.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />{selected.sector}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />Last review {formatDate(selected.lastReviewDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />Owner {selected.owner}
                </span>
              </div>
            </section>

            {(conflictCount > 0 || dataWarning) && !loading && (
              <Alert className="mb-5 border-amber-200 bg-amber-50/90 py-3 text-amber-950">
                <TriangleAlert className="text-amber-600" />
                <AlertTitle>
                  {dataWarning
                    ? 'Live data is unavailable'
                    : conflictCount === 1
                      ? '1 statement has values that differ'
                      : `${conflictCount} statements have values that differ`}
                </AlertTitle>
                <AlertDescription className="text-amber-800">
                  {dataWarning
                    ? showBrief
                      ? 'The last verified brief remains visible.'
                      : 'Select Refresh brief to try again.'
                    : 'Open Evidence and compare the dated values before you use the statement.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_248px]">
              <div className="space-y-3">
                {!showBrief ? (
                  <BriefSkeleton />
                ) : (
                  <>
                    <EvidenceSection
                      expandedItemId={expandedItemId}
                      items={brief.changes}
                      onOpenSource={openFullSource}
                      onToggleItem={toggleEvidence}
                      sources={brief.sources}
                      title={selected.lastReviewDate
                        ? `Changes after ${formatDate(selected.lastReviewDate)}`
                        : 'Changes since last review (date not recorded)'}
                    />
                    <EvidenceSection
                      expandedItemId={expandedItemId}
                      items={brief.currentState}
                      onOpenSource={openFullSource}
                      onToggleItem={toggleEvidence}
                      sources={brief.sources}
                      title="Key facts now"
                    />
                    <EvidenceSection
                      expandedItemId={expandedItemId}
                      items={brief.risks}
                      onOpenSource={openFullSource}
                      onToggleItem={toggleEvidence}
                      sources={brief.sources}
                      title="Risks"
                    />
                    <EvidenceSection
                      expandedItemId={expandedItemId}
                      items={[...brief.openQuestions, ...brief.suggestedQuestions]}
                      onOpenSource={openFullSource}
                      onToggleItem={toggleEvidence}
                      sources={brief.sources}
                      title="Questions"
                    />
                  </>
                )}
              </div>
              {showBrief ? <CoveragePanel brief={brief} /> : <Skeleton className="h-44 rounded-xl" />}
            </div>

            <footer className="mt-7 border-t border-stone-200 py-4 text-[11px] text-slate-500">
              Generated analysis supports preparation. It does not make an investment decision.
            </footer>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(openSource)} onOpenChange={(open) => !open && closeSource()}>
        <DialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh max-w-full translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none border-stone-200 bg-[#fbfaf7] p-0 sm:max-w-[560px]">
          {openSource && (
            <>
              <DialogHeader className="border-b border-stone-200 px-5 py-4 pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white text-[10px]" variant="outline">
                    {sourceLabel(openSource.sourceType)}
                  </Badge>
                  <time className="text-[11px] text-slate-500" dateTime={openSource.sourceDate}>
                    {formatDate(openSource.sourceDate)}
                  </time>
                  <span className="text-[11px] text-slate-500">
                    {openSource.verificationStatus
                      ? humanizeField(openSource.verificationStatus)
                      : 'Verification is not specified'}
                  </span>
                </div>
                <DialogTitle className="font-display text-[26px] font-normal leading-tight text-[#162d4e]">
                  {openSource.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Full stored source for the selected statement.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="min-h-0 px-5 py-4">
                <div aria-live="polite" className="mb-3 min-h-5 text-[11px] text-slate-500">
                  {sourceLoading && (
                    <span className="inline-flex items-center gap-1.5">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading the full source record
                    </span>
                  )}
                  {sourceError && (
                    <span className="text-amber-700">{sourceError} The imported source text remains visible.</span>
                  )}
                </div>
                {sourceParentItem && (
                  <section className="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                    <p className="text-[11px] font-semibold text-blue-800">Selected statement</p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-700">{sourceParentItem.text}</p>
                  </section>
                )}

                <section>
                  <p className="text-xs font-semibold text-slate-800">Source content</p>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-[13px] leading-6 text-slate-700">
                    <HighlightedText text={sourceContent} values={sourceValues} />
                  </div>
                </section>

                {sourceDetail?.facts && sourceDetail.facts.length > 0 && (
                  <section className="mt-4">
                    <p className="text-xs font-semibold text-slate-800">Structured values</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {sourceDetail.facts.map((fact) => (
                        <div className="rounded-lg border border-stone-200 bg-white p-3" key={`${fact.key}-${fact.value}`}>
                          <p className="text-[10px] text-slate-500">{humanizeField(fact.key)}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</p>
                          {fact.date && (
                            <time className="mt-1 block text-[10px] text-slate-500" dateTime={fact.date}>
                              {formatDate(fact.date)}
                            </time>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <details className="group mt-4 rounded-xl border border-stone-200 bg-white">
                  <summary className="flex min-h-11 list-none items-center justify-between gap-3 px-3.5 text-xs font-semibold text-slate-800">
                    Record details
                    <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-stone-100 px-3.5 py-3 text-[11px]">
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {[
                        ['Source date', sourceDetail?.sourceDate ?? openSource.sourceDate],
                        ['Event date', sourceDetail?.eventDate],
                        ['Publication date', sourceDetail?.publicationDate],
                        ['Modified date', sourceDetail?.modifiedDate],
                        ['Import date', sourceDetail?.ingestedAt],
                        ['Verification date', sourceDetail?.verifiedAt],
                      ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => (
                        <div className="rounded-md bg-stone-50 p-2.5" key={label}>
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="mt-0.5 font-medium text-slate-700">{formatDate(value)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 rounded-md bg-stone-50 p-2.5">
                      <p className="text-slate-500">Source location</p>
                      <p className="mt-0.5 break-words font-medium text-slate-700">{openSource.locator}</p>
                    </div>
                    {originalUrl && (
                      <a
                        className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        href={originalUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open original source <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </details>

                {sourceDetail?.rawContent && Object.keys(sourceDetail.rawContent).length > 0 && (
                  <details className="group mt-3 rounded-xl border border-stone-200 bg-white">
                    <summary className="flex min-h-11 list-none items-center justify-between gap-3 px-3.5 text-xs font-semibold text-slate-800">
                      Original record
                      <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
                    </summary>
                    <dl className="border-t border-stone-100 px-3.5 py-3 text-[11px]">
                      {Object.entries(sourceDetail.rawContent).map(([key, value]) => (
                        <div className="border-b border-stone-100 py-2 last:border-0" key={key}>
                          <dt className="font-semibold text-slate-500">{humanizeField(key)}</dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{displayRawValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
