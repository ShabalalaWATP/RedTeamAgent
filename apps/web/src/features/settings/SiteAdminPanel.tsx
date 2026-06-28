import { ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { AccountStatus, AccountType, AdminScope, SiteUser, SiteVisit } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';
import { analyseVisits, shortUserAgent, VisitInsightsPanel } from './VisitInsightsPanel';

const accountTypes: AccountType[] = ['owner', 'admin', 'user'];
const accountStatuses: AccountStatus[] = ['active', 'suspended', 'banned', 'deleted'];
const adminScopes: AdminScope[] = ['selected', 'all', 'none'];

type GroupedUsers = Record<AccountType, SiteUser[]>;

export function SiteAdminPanel() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<SiteUser>>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const isOwner = auth?.accountType === 'owner';
  const visibleUsers = useMemo(() => users.filter((user) => user.account_status !== 'deleted'), [users]);
  const groupedUsers = useMemo(() => groupUsers(visibleUsers), [visibleUsers]);
  const visitInsights = useMemo(() => analyseVisits(visits, users), [visits, users]);

  const load = async () => {
    if (!auth || !['owner', 'admin'].includes(auth.accountType)) return;
    const [nextUsers, nextVisits] = await Promise.all([api.siteUsers(), api.siteVisits()]);
    setUsers(nextUsers);
    setVisits(nextVisits);
  };

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [auth?.accountType]);

  if (!auth || !['owner', 'admin'].includes(auth.accountType)) return null;

  const draftFor = (user: SiteUser): SiteUser => ({ ...user, ...drafts[user.id] });
  const updateDraft = (userId: string, patch: Partial<SiteUser>) => {
    setDrafts((current) => ({ ...current, [userId]: { ...current[userId], ...patch } }));
  };

  const save = async (user: SiteUser, patch: Partial<SiteUser> = {}) => {
    setError(null);
    const draft = { ...draftFor(user), ...patch };
    try {
      const updated = await api.updateSiteUser(auth.csrfToken, user.id, {
        account_type: draft.account_type,
        account_status: draft.account_status,
        status_message: draft.status_message,
        admin_scope: draft.admin_scope,
        admin_managed_user_ids: draft.admin_managed_user_ids
      });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setMessage('Account updated.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (user: SiteUser) => {
    setError(null);
    try {
      const updated = await api.deleteSiteUser(auth.csrfToken, user.id);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Account deleted.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="settings-block stack site-admin-panel">
      <ErrorState message={error} />
      {message ? <p className="muted" role="status">{message}</p> : null}
      <details className="settings-disclosure site-admin-disclosure" open>
        <summary>
          <h2><Users size={20} aria-hidden="true" /> Site administration</h2>
          <small>{accountSummary(groupedUsers)}</small>
        </summary>
        <div className="settings-block-header site-admin-toolbar">
          <p className="muted">Owner, admin and user accounts are separated so privilege changes are easier to review.</p>
          <Button type="button" onClick={() => void load()}>Refresh</Button>
        </div>
        {visibleUsers.length === 0 ? (
          <EmptyState title="No users visible" body="Assigned users will appear here." />
        ) : (
          <div className="account-role-sections">
            <AccountGroup
              authUserId={auth.userId}
              isOwner={isOwner}
              title="Owners"
              users={groupedUsers.owner}
              visibleUsers={visibleUsers}
              draftFor={draftFor}
              onDraft={updateDraft}
              onSave={save}
              onDelete={remove}
            />
            <AccountGroup
              authUserId={auth.userId}
              isOwner={isOwner}
              title="Admins"
              users={groupedUsers.admin}
              visibleUsers={visibleUsers}
              draftFor={draftFor}
              onDraft={updateDraft}
              onSave={save}
              onDelete={remove}
            />
            <AccountGroup
              authUserId={auth.userId}
              isOwner={isOwner}
              title="Users"
              users={groupedUsers.user}
              visibleUsers={visibleUsers}
              draftFor={draftFor}
              onDraft={updateDraft}
              onSave={save}
              onDelete={remove}
            />
          </div>
        )}
      </details>
      <details className="settings-disclosure site-visits-disclosure" open>
        <summary>
          <h2><ShieldAlert size={20} aria-hidden="true" /> Recent visits</h2>
          <small>{visitInsights.summary}</small>
        </summary>
        <VisitInsightsPanel insights={visitInsights} />
        <div className="site-visits">
          {visits.length === 0 ? <p className="muted">No visits recorded yet.</p> : null}
          {visits.slice(0, 20).map((visit) => (
            <article className="visit-row" key={visit.id}>
              <strong>{visit.ip_address}</strong>
              <span>{visit.method} {visit.path}</span>
              <small>{userLabel(users, visit.user_id)} · {formatWhen(visit.created_at)} · {shortUserAgent(visit.user_agent)}</small>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

function AccountGroup({
  authUserId,
  isOwner,
  title,
  users,
  visibleUsers,
  draftFor,
  onDraft,
  onSave,
  onDelete
}: {
  authUserId: string;
  isOwner: boolean;
  title: string;
  users: SiteUser[];
  visibleUsers: SiteUser[];
  draftFor: (user: SiteUser) => SiteUser;
  onDraft: (userId: string, patch: Partial<SiteUser>) => void;
  onSave: (user: SiteUser, patch?: Partial<SiteUser>) => Promise<void>;
  onDelete: (user: SiteUser) => Promise<void>;
}) {
  if (users.length === 0) return null;
  return (
    <section className="account-role-section">
      <header className="account-role-header">
        <h3>{title}</h3>
        <span>{users.length}</span>
      </header>
      <div className="site-user-grid">
        {users.map((user) => (
          <UserAdminCard
            authUserId={authUserId}
            isOwner={isOwner}
            key={user.id}
            user={user}
            users={visibleUsers}
            draft={draftFor(user)}
            onDraft={(patch) => onDraft(user.id, patch)}
            onSave={(patch) => void onSave(user, patch)}
            onDelete={() => void onDelete(user)}
          />
        ))}
      </div>
    </section>
  );
}

function UserAdminCard({
  authUserId,
  isOwner,
  user,
  users,
  draft,
  onDraft,
  onSave,
  onDelete
}: {
  authUserId: string;
  isOwner: boolean;
  user: SiteUser;
  users: SiteUser[];
  draft: SiteUser;
  onDraft: (patch: Partial<SiteUser>) => void;
  onSave: (patch?: Partial<SiteUser>) => void;
  onDelete: () => void;
}) {
  const canEditRole = isOwner && user.id !== authUserId;
  const canDelete = user.id !== authUserId && user.account_type !== 'owner';
  const canEditStatus = user.id !== authUserId;
  const isProtectedSelf = user.id === authUserId && user.account_type === 'owner';
  const selectedIds = new Set(draft.admin_managed_user_ids);
  return (
    <article className="site-user-card">
      <header>
        <div>
          <strong>{user.email}</strong>
          <small>{user.account_type} · {user.account_status} · {user.run_count} runs</small>
        </div>
        <Status tone={statusTone(user.account_status)}>{user.account_status}</Status>
      </header>
      <dl>
        <div><dt>Last login</dt><dd>{formatWhen(user.last_login_at)} · {user.last_login_ip ?? 'no IP'}</dd></div>
        <div><dt>Last seen</dt><dd>{formatWhen(user.last_seen_at)} · {user.last_seen_ip ?? 'no IP'}</dd></div>
      </dl>
      {canEditRole ? (
        <div className="site-admin-controls">
          <Field label="Account type">
            <select value={draft.account_type} onChange={(event) => onDraft({ account_type: event.target.value as AccountType })}>
              {accountTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          {draft.account_type === 'admin' ? (
            <Field label="Admin scope">
              <select value={draft.admin_scope} onChange={(event) => onDraft({ admin_scope: event.target.value as AdminScope })}>
                {adminScopes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          ) : null}
          {draft.account_type === 'admin' && draft.admin_scope === 'selected' ? (
            <div className="managed-user-list" aria-label={`Managed users for ${user.email}`}>
              {users.filter((item) => item.account_type === 'user' && item.id !== user.id).map((item) => (
                <label key={item.id}>
                  <input
                    checked={selectedIds.has(item.id)}
                    onChange={(event) => onDraft({ admin_managed_user_ids: toggleId(selectedIds, item.id, event.target.checked) })}
                    type="checkbox"
                  />
                  <span>{item.email}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {isProtectedSelf ? <ProtectedOwnerNotice status={user.account_status} message={user.status_message} /> : null}
      {canEditStatus ? (
        <>
          <Field label="Account status">
            <select
              value={draft.account_status}
              onChange={(event) => onDraft({ account_status: event.target.value as AccountStatus })}
            >
              {accountStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Login message">
            <textarea
              rows={2}
              value={draft.status_message}
              onChange={(event) => onDraft({ status_message: event.target.value })}
              placeholder="Shown if this account is suspended, banned or deleted."
            />
          </Field>
          <div className="site-admin-actions">
            <Button type="button" variant="primary" onClick={() => onSave()}>Save</Button>
            <Button type="button" onClick={() => onSave({ account_status: 'suspended' })}>Suspend</Button>
            <Button type="button" variant="danger" onClick={() => onSave({ account_status: 'banned' })}>Ban</Button>
            {canDelete ? <Button type="button" variant="danger" onClick={onDelete}>Delete</Button> : null}
          </div>
        </>
      ) : null}
    </article>
  );
}

function ProtectedOwnerNotice({ status, message }: { status: AccountStatus; message: string }) {
  return (
    <div className="protected-owner-note">
      <ShieldCheck size={18} aria-hidden="true" />
      <span>
        <strong>Protected owner session</strong>
        <small>Status: {status}. {message ? `Login message: ${message}` : 'No blocking login message.'}</small>
      </span>
    </div>
  );
}

function toggleId(current: Set<string>, id: string, checked: boolean) {
  const next = new Set(current);
  if (checked) next.add(id);
  else next.delete(id);
  return [...next];
}

function groupUsers(users: SiteUser[]): GroupedUsers {
  return {
    owner: users.filter((user) => user.account_type === 'owner'),
    admin: users.filter((user) => user.account_type === 'admin'),
    user: users.filter((user) => user.account_type === 'user')
  };
}

function accountSummary(groups: GroupedUsers) {
  return `${groups.owner.length} owner${plural(groups.owner.length)}, ${groups.admin.length} admin${plural(groups.admin.length)}, ${groups.user.length} user${plural(groups.user.length)}`;
}

function userLabel(users: SiteUser[], userId?: string | null) {
  if (!userId) return 'anonymous';
  return users.find((user) => user.id === userId)?.email ?? 'registered user';
}

function formatWhen(value?: string | null) {
  if (!value) return 'never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function plural(count: number) {
  return count === 1 ? '' : 's';
}

function statusTone(status: AccountStatus) {
  if (status === 'active') return 'ok';
  if (status === 'suspended') return 'warn';
  return 'bad';
}
