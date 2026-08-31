'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Newspaper,
  Search,
  ShieldCheck,
  Sparkles,
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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fallbackBrief, fallbackCompanies } from '@/lib/fallback-data';
import type {
  BriefItem,
  BriefResult,
  Company,
  EvidenceState,
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

function formatDate(value: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function sourceLabel(type: SourceReference['sourceType']) {
  if (type === 'crm') return 'CRM';
  if (type === 'slack') return 'Slack';
  return type[0].toUpperCase() + type.slice(1);
}

function CompanyList({
  companies,
  activeId,
  onSelect,
}: {
  companies: Company[];
  activeId: string;
  onSelect: (company: Company) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = companies.filter((company) =>
    `${company.name} ${company.sector}`.toLowerCase().includes(query.toLowerCase()),
  );

  const list = (status: 'portfolio' | 'pipeline') => (
    <div className="space-y-1.5">
      {filtered
        .filter((company) => company.relationshipStatus === status)
        .map((company) => {
          const active = company.id === activeId;
          return (
            <button
              key={company.id}
              className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? 'border-blue-200 bg-white shadow-[0_4px_18px_rgb(42_70_110/8%)]'
                  : 'border-transparent hover:border-stone-200 hover:bg-white/70'
              }`}
              onClick={() => onSelect(company)}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                  active
                    ? 'bg-[#dce9ff] text-[#26599e]'
                    : 'bg-stone-200/70 text-stone-600'
                }`}
              >
                {company.name
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-800">
                  {company.name}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {status === 'portfolio' ? company.companyStage : company.pipelineStage}
                </span>
              </span>
              {active && <ChevronRight className="h-4 w-4 text-blue-500" />}
            </button>
          );
        })}
    </div>
  );

  return (
    <aside className="border-r border-stone-200/80 bg-[#f6f3ed]/90 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-[264px]">
      <div className="flex h-[68px] items-center gap-3 border-b border-stone-200/80 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#18345c] text-sm font-bold tracking-tight text-white shadow-sm">
          AI
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">AIVC</p>
          <p className="text-[11px] text-slate-500">Company intelligence</p>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Search companies"
            className="h-9 border-stone-200 bg-white/80 pl-9 text-sm shadow-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a company"
            value={query}
          />
        </div>
        <Tabs defaultValue="portfolio">
          <TabsList className="grid w-full grid-cols-2 bg-stone-200/70">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>
          <TabsContent value="portfolio" className="mt-3">
            {list('portfolio')}
          </TabsContent>
          <TabsContent value="pipeline" className="mt-3">
            <ScrollArea className="h-[calc(100vh-220px)]">{list('pipeline')}</ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      <div className="absolute bottom-0 hidden w-full border-t border-stone-200/80 bg-[#f6f3ed] p-4 lg:block">
        <div className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-[11px] text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Evidence stays within one company.</span>
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
    <div className="mt-3 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const source = sources.find((item) => item.id === id);
        if (!source) return null;
        const Icon = sourceIcon[source.sourceType];
        return (
          <button
            key={id}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
            onClick={() => onOpen(source)}
            title={`Open ${source.title}`}
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
  const StateIcon = item.state === 'confirmed' ? CheckCircle2 : CircleAlert;
  return (
    <div className="border-b border-stone-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <StateIcon
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            item.state === 'confirmed' ? 'text-emerald-600' : 'text-amber-600'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-semibold uppercase tracking-[0.08em]">
              {item.kind === 'fact'
                ? 'Source fact'
                : item.kind === 'analysis'
                  ? 'Generated analysis'
                  : 'Question'}
            </Badge>
            {item.state !== 'confirmed' && (
              <Badge
                variant="outline"
                className={`h-5 rounded-md px-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${stateStyle[item.state]}`}
              >
                {item.state}
              </Badge>
            )}
          </div>
          <p className="text-[14px] leading-6 text-slate-700">{item.text}</p>
          <SourcePills ids={item.sourceIds} sources={sources} onOpen={onOpen} />
        </div>
      </div>
    </div>
  );
}

function EvidenceSection({
  title,
  note,
  items,
  sources,
  onOpen,
}: {
  title: string;
  note: string;
  items: BriefItem[];
  sources: SourceReference[];
  onOpen: (source: SourceReference) => void;
}) {
  return (
    <Card className="border-stone-200/90 bg-white/90 shadow-[0_10px_34px_rgb(34_53_80/5%)]">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display text-[25px] font-normal tracking-tight text-slate-900">
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          </div>
          <Badge variant="secondary" className="rounded-full px-2.5 text-[10px] tabular-nums">
            {items.length}
          </Badge>
        </div>
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
        <Card key={item} className="border-stone-200 bg-white/80">
          <CardHeader><Skeleton className="h-7 w-40" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-8 w-60" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CoveragePanel({ brief }: { brief: BriefResult }) {
  const total = brief.coverage.reduce((sum, item) => sum + item.count, 0);
  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      <Card className="overflow-hidden border-stone-200/90 bg-[#18345c] text-white shadow-[0_16px_42px_rgb(21_45_79/14%)]">
        <CardHeader className="pb-3">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <ShieldCheck className="h-4 w-4 text-[#bcd5ff]" />
          </div>
          <CardTitle className="text-base">Evidence quality</CardTitle>
          <p className="text-xs leading-5 text-slate-300">
            {total} records support this brief. The query uses only {brief.company.name} data.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
            <span>Source coverage</span>
            <span className="font-semibold text-white">100%</span>
          </div>
          <Progress value={100} className="h-1.5 bg-white/15 [&>div]:bg-[#9ec2ff]" />
          <Separator className="my-5 bg-white/10" />
          <div className="space-y-3">
            {brief.coverage.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{item.category}</span>
                <span className="font-medium tabular-nums text-white">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-stone-200/90 bg-white/90">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Source register</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {brief.coverage.map((item) => (
              <div key={item.category} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-slate-700">{item.category}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Newest record: {formatDate(item.latestDate)}</p>
                </div>
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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'ready' | 'offline' | 'error'>('offline');
  const conflictCount = useMemo(
    () =>
      [...brief.currentState, ...brief.changes, ...brief.risks].filter(
        (item) => item.state === 'conflict',
      ).length,
    [brief],
  );

  useEffect(() => {
    fetch('/api/companies')
      .then((response) => {
        if (!response.ok) throw new Error('The database is not ready.');
        return response.json() as Promise<{ companies: Company[] }>;
      })
      .then((data) => {
        if (data.companies.length) {
          setCompanies(data.companies);
          const first = data.companies.find((company) => company.id === 'cmp_vectorforge');
          if (first) setSelected(first);
          setStatus('ready');
        }
      })
      .catch(() => setStatus('offline'));
  }, []);

  async function generateBrief(company = selected) {
    setSelected(company);
    setLoading(true);
    try {
      const response = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
      });
      if (!response.ok) throw new Error('Brief generation failed.');
      setBrief((await response.json()) as BriefResult);
      setStatus('ready');
    } catch {
      setStatus('error');
      if (company.id === 'cmp_vectorforge') setBrief(fallbackBrief);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-900">
      <CompanyList activeId={selected.id} companies={companies} onSelect={generateBrief} />
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-stone-200/80 bg-[#fbfaf7]/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Company brief</span><ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-800">{selected.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 bg-white/80 text-[10px] text-slate-600 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {status === 'ready' ? 'Data store ready' : 'Preview data'}
            </Badge>
            <Button onClick={() => generateBrief()} disabled={loading} size="sm" className="h-9 bg-[#315f9f] px-3.5 shadow-sm hover:bg-[#244e87]">
              {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {loading ? 'Preparing brief' : 'Generate current brief'}
            </Button>
          </div>
        </header>

        <div className="fine-grid min-h-[calc(100vh-68px)] px-5 py-8 sm:px-8 xl:px-10">
          <div className="mx-auto max-w-[1420px]">
            <section className="mb-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-[#e0eaff] px-2.5 text-[#28538e] hover:bg-[#e0eaff]">
                    {selected.relationshipStatus === 'portfolio' ? 'Portfolio company' : 'Pipeline company'}
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-white/60 text-slate-600">{selected.companyStage}</Badge>
                  {selected.pipelineStage && <Badge variant="outline" className="rounded-full bg-white/60 text-slate-600">{selected.pipelineStage}</Badge>}
                </div>
                <h1 className="font-display text-[42px] leading-none tracking-[-0.035em] text-[#162d4e] sm:text-[54px]">{selected.name}</h1>
                <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600">{selected.description}</p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{selected.sector}</span>
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Last review {formatDate(selected.lastReviewDate)}</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Owner {selected.owner}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 self-end xl:grid-cols-1">
                {[
                  ['Generation time', `${(brief.durationMs / 1000).toFixed(1)} sec`],
                  ['Evidence records', String(brief.sources.length)],
                  ['Newest evidence', formatDate(brief.company.latestSourceDate)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-stone-200/90 bg-white/70 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-700">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {(conflictCount > 0 || status === 'error') && (
              <Alert className="mb-6 border-amber-200 bg-amber-50/90 text-amber-950">
                <TriangleAlert className="text-amber-600" />
                <AlertTitle>{status === 'error' ? 'The live service is not available' : 'Evidence needs review'}</AlertTitle>
                <AlertDescription className="text-amber-800">
                  {status === 'error'
                    ? 'The interface shows the verified preview brief. Start the local data store to use all companies.'
                    : `${conflictCount} fact has conflicting values. The brief keeps both values and shows the sources.`}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                {loading ? <BriefSkeleton /> : (
                  <>
                    <EvidenceSection title="Current state" note="Verified facts from the newest approved evidence." items={brief.currentState} sources={brief.sources} onOpen={setOpenSource} />
                    <EvidenceSection title="What changed" note="Dated changes since the last important review." items={brief.changes} sources={brief.sources} onOpen={setOpenSource} />
                    <EvidenceSection title="Risks" note="Generated analysis. Review the cited evidence before you use it." items={brief.risks} sources={brief.sources} onOpen={setOpenSource} />
                    <div className="grid gap-5 md:grid-cols-2">
                      <EvidenceSection title="Open questions" note="Missing, old, or unclear information." items={brief.openQuestions} sources={brief.sources} onOpen={setOpenSource} />
                      <EvidenceSection title="Questions to ask" note="Questions for the next company discussion." items={brief.suggestedQuestions} sources={brief.sources} onOpen={setOpenSource} />
                    </div>
                  </>
                )}
              </div>
              <CoveragePanel brief={brief} />
            </div>

            <footer className="mt-8 flex flex-col gap-2 border-t border-stone-200 py-5 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Generated analysis supports preparation. It does not make an investment decision.</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" />Brief prepared {formatDate(brief.generatedAt)}</span>
            </footer>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(openSource)} onOpenChange={(open) => !open && setOpenSource(null)}>
        <DialogContent className="max-h-[84vh] overflow-hidden border-stone-200 bg-[#fbfaf7] sm:max-w-2xl">
          {openSource && (
            <>
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="bg-white text-[10px] uppercase tracking-[0.08em]">{sourceLabel(openSource.sourceType)} source</Badge>
                  <span className="text-xs text-slate-500">{formatDate(openSource.sourceDate)}</span>
                </div>
                <DialogTitle className="font-display text-3xl font-normal text-[#162d4e]">{openSource.title}</DialogTitle>
                <DialogDescription className="text-xs">Source ID: {openSource.id}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] pr-4">
                <div className="rounded-xl border border-stone-200 bg-white p-5 text-sm leading-7 text-slate-700">{openSource.content}</div>
                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-lg bg-stone-100 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Source locator</p>
                    <p className="mt-1 break-words text-slate-700">{openSource.locator}</p>
                  </div>
                  <div className="rounded-lg bg-stone-100 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Verification</p>
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
