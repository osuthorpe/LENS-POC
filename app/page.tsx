'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleHelp,
  Clock3,
  Database,
  FileText,
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { fallbackBrief, fallbackCompanies } from '@/lib/fallback-data';
import type {
  BriefItem,
  BriefResult,
  Company,
  EvidenceState,
  RelationshipStatus,
  SourceReference,
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

function SourcePills({
  ids,
  sources,
  onOpen,
}: {
  ids: string[];
  sources: SourceReference[];
  onOpen: (source: SourceReference) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const source = sources.find((item) => item.id === id);
        if (!source) return null;
        const Icon = sourceIcon[source.sourceType];
        return (
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50/70 px-2.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            key={id}
            onClick={() => onOpen(source)}
            title={`Open ${source.title}`}
            type="button"
          >
            <Icon className="h-3 w-3" />
            {sourceLabel(source.sourceType)} · {formatDate(source.sourceDate)}
          </button>
        );
      })}
    </div>
  );
}

function EvidenceItem({
  item,
  sources,
  onOpen,
}: {
  item: BriefItem;
  sources: SourceReference[];
  onOpen: (source: SourceReference) => void;
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
  return (
    <div className="border-b border-stone-100 py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start gap-2.5">
        {StateIcon && <StateIcon className={`mt-1 h-4 w-4 shrink-0 ${stateIconStyle[item.state]}`} />}
        <div className="min-w-0 flex-1">
          {item.state !== 'confirmed' && (
            <Badge
              className={`mb-1.5 h-5 rounded-md px-1.5 text-[10px] font-semibold ${stateStyle[item.state]}`}
              variant="outline"
            >
              {item.state}
            </Badge>
          )}
          <p className="text-[13px] leading-[1.55rem] text-slate-700">{item.text}</p>
          <SourcePills ids={item.sourceIds} sources={sources} onOpen={onOpen} />
        </div>
      </div>
    </div>
  );
}

function EvidenceSection({
  title,
  items,
  sources,
  onOpen,
}: {
  title: string;
  items: BriefItem[];
  sources: SourceReference[];
  onOpen: (source: SourceReference) => void;
}) {
  return (
    <Card className="border-stone-200/90 bg-white/95 shadow-[0_8px_28px_rgb(34_53_80/4%)]">
      <CardHeader className="pb-2.5">
        <CardTitle className="font-display text-[23px] font-normal tracking-tight text-slate-900">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.map((item) => (
          <EvidenceItem key={item.id} item={item} sources={sources} onOpen={onOpen} />
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
  const reviewCount = [
    ...brief.currentState,
    ...brief.changes,
    ...brief.risks,
    ...brief.openQuestions,
    ...brief.suggestedQuestions,
  ].filter((item) => item.state !== 'confirmed').length;
  return (
    <aside className="xl:sticky xl:top-20 xl:self-start">
      <Card className="border-stone-200/90 bg-white/95 shadow-[0_8px_28px_rgb(34_53_80/4%)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <CardTitle className="text-sm">Evidence</CardTitle>
            </div>
            <Badge
              className={reviewCount > 0
                ? 'border-amber-200 bg-amber-50 text-[10px] text-amber-800'
                : 'border-blue-200 bg-blue-50 text-[10px] text-blue-800'}
              variant="outline"
            >
              {reviewCount > 0 ? `${reviewCount} to review` : 'Company only'}
            </Badge>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {total} records · through {formatDate(brief.company.latestSourceDate)}
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
  const [openSource, setOpenSource] = useState<SourceReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ready' | 'offline' | 'error'>('offline');
  const requestId = useRef(0);
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

  async function generateBrief(company = selected) {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
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
                    : `${conflictCount} source conflict needs review`}
                </AlertTitle>
                <AlertDescription className="text-amber-800">
                  {dataWarning
                    ? showBrief
                      ? 'The last verified brief remains visible.'
                      : 'Select Refresh brief to try again.'
                    : 'The brief keeps both values and their sources.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_248px]">
              <div className="space-y-4">
                {!showBrief ? (
                  <BriefSkeleton />
                ) : (
                  <>
                    <EvidenceSection
                      items={brief.changes}
                      onOpen={setOpenSource}
                      sources={brief.sources}
                      title="What changed"
                    />
                    <EvidenceSection
                      items={brief.currentState}
                      onOpen={setOpenSource}
                      sources={brief.sources}
                      title="Current state"
                    />
                    <EvidenceSection
                      items={brief.risks}
                      onOpen={setOpenSource}
                      sources={brief.sources}
                      title="Risks"
                    />
                    <div className="grid gap-4 2xl:grid-cols-2">
                      <EvidenceSection
                        items={brief.openQuestions}
                        onOpen={setOpenSource}
                        sources={brief.sources}
                        title="Open questions"
                      />
                      <EvidenceSection
                        items={brief.suggestedQuestions}
                        onOpen={setOpenSource}
                        sources={brief.sources}
                        title="Questions to ask"
                      />
                    </div>
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

      <Dialog open={Boolean(openSource)} onOpenChange={(open) => !open && setOpenSource(null)}>
        <DialogContent className="max-h-[84vh] overflow-hidden border-stone-200 bg-[#fbfaf7] sm:max-w-2xl">
          {openSource && (
            <>
              <DialogHeader>
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge className="bg-white text-[10px]" variant="outline">
                    {sourceLabel(openSource.sourceType)}
                  </Badge>
                  <span className="text-[11px] text-slate-500">{formatDate(openSource.sourceDate)}</span>
                </div>
                <DialogTitle className="font-display text-[28px] font-normal leading-tight text-[#162d4e]">
                  {openSource.title}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[52vh] pr-4">
                <div className="rounded-xl border border-stone-200 bg-white p-4 text-[13px] leading-6 text-slate-700">
                  {openSource.content}
                </div>
                <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                  <div className="rounded-lg bg-stone-100 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">Source</p>
                    <p className="mt-1 break-words text-slate-700">{openSource.locator}</p>
                  </div>
                  <div className="rounded-lg bg-stone-100 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">Verification</p>
                    <p className="mt-1 text-slate-700">{openSource.verificationStatus ?? 'Not specified'}</p>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
