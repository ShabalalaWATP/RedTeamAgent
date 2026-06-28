import type { SiteUser, SiteVisit } from '../../shared/types';
import { Status } from '../../shared/ui';

const privilegedPath = /^\/(settings|providers|enterprise|site-admin)(\/|$)/i;

type CountedValue = {
  value: string;
  count: number;
};

export type VisitInsights = {
  total: number;
  uniqueIpCount: number;
  authenticatedCount: number;
  anonymousCount: number;
  summary: string;
  signals: string[];
  tone: 'ok' | 'warn' | 'info';
};

export function VisitInsightsPanel({ insights }: { insights: VisitInsights }) {
  return (
    <div className="visit-insights">
      <div>
        <strong>{insights.total}</strong>
        <span>Total visits</span>
      </div>
      <div>
        <strong>{insights.uniqueIpCount}</strong>
        <span>Unique IPs</span>
      </div>
      <div>
        <strong>{insights.authenticatedCount}</strong>
        <span>Signed in</span>
      </div>
      <div>
        <strong>{insights.anonymousCount}</strong>
        <span>Anonymous</span>
      </div>
      <div className="visit-insight-wide">
        <Status tone={insights.tone}>{insights.tone === 'warn' ? 'Review' : 'Normal'}</Status>
        <span>{insights.signals.join(' ')}</span>
      </div>
    </div>
  );
}

export function analyseVisits(visits: SiteVisit[], users: SiteUser[]): VisitInsights {
  const knownUserIds = new Set(users.map((user) => user.id));
  const topIp = topCount(visits.map((visit) => visit.ip_address));
  const topPath = topCount(visits.map((visit) => visit.path));
  const uniqueIpCount = new Set(visits.map((visit) => visit.ip_address)).size;
  const authenticatedCount = visits.filter((visit) => Boolean(visit.user_id)).length;
  const anonymousCount = visits.length - authenticatedCount;
  const anonymousPrivileged = visits.filter((visit) => !visit.user_id && privilegedPath.test(visit.path)).length;
  const writeRequests = visits.filter((visit) => visit.method.toUpperCase() !== 'GET').length;
  const unknownUsers = visits.filter((visit) => visit.user_id && !knownUserIds.has(visit.user_id)).length;
  const repeatedIp = topIp && topIp.count >= Math.max(5, Math.ceil(visits.length * 0.4));
  const signals = visitSignals(anonymousPrivileged, repeatedIp ? topIp : null, writeRequests, unknownUsers, topPath);
  return {
    total: visits.length,
    uniqueIpCount,
    authenticatedCount,
    anonymousCount,
    signals,
    summary: visits.length === 0 ? 'No visits recorded' : `${uniqueIpCount} IP${plural(uniqueIpCount)} across ${visits.length} visit${plural(visits.length)}`,
    tone: anonymousPrivileged > 0 || repeatedIp || unknownUsers > 0 ? 'warn' : visits.length > 0 ? 'ok' : 'info'
  };
}

export function shortUserAgent(value: string) {
  if (!value) return 'unknown user agent';
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
}

function visitSignals(
  anonymousPrivileged: number,
  repeatedIp: CountedValue | null,
  writeRequests: number,
  unknownUsers: number,
  topPath: CountedValue | null
) {
  const signals: string[] = [];
  if (anonymousPrivileged > 0) {
    signals.push(`${anonymousPrivileged} anonymous visit${plural(anonymousPrivileged)} touched privileged pages.`);
  }
  if (repeatedIp) {
    signals.push(`${repeatedIp.value} accounts for ${repeatedIp.count} recent visit${plural(repeatedIp.count)}.`);
  }
  if (writeRequests > 0) {
    signals.push(`${writeRequests} non-GET request${plural(writeRequests)} observed.`);
  }
  if (unknownUsers > 0) {
    signals.push(`${unknownUsers} visit${plural(unknownUsers)} came from registered users outside this view.`);
  }
  if (signals.length === 0 && topPath) {
    signals.push(`Most common path: ${topPath.value}.`);
  }
  return signals.length ? signals : ['No visitor anomalies in the current sample.'];
}

function topCount(values: string[]): CountedValue | null {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let top: CountedValue | null = null;
  counts.forEach((count, value) => {
    if (!top || count > top.count) top = { value, count };
  });
  return top;
}

function plural(count: number) {
  return count === 1 ? '' : 's';
}
