import { ShieldAlert, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import type { AccountStatus, AccountType, AdminScope, SiteUser, SiteVisit } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field } from '../../shared/ui';

const accountTypes: AccountType[] = ['owner', 'admin', 'user'];
const accountStatuses: AccountStatus[] = ['active', 'suspended', 'banned', 'deleted'];
const adminScopes: AdminScope[] = ['selected', 'all', 'none'];

export function SiteAdminPanel() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<SiteUser>>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const isOwner = auth?.accountType === 'owner';
  const visibleUsers = useMemo(() => users.filter((user) => user.account_status !== 'deleted'), [users]);

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
      <div className="settings-block-header">
        <div>
          <h2><Users size={20} /> Site administration</h2>
          <p className="muted">Monitor sign-ups, usage, account status and visitor IPs.</p>
        </div>
        <Button type="button" onClick={() => void load()}>Refresh</Button>
      </div>
      <ErrorState message={error} />
      {message ? <p className="muted" role="status">{message}</p> : null}
      {visibleUsers.length === 0 ? (
        <EmptyState title="No users visible" body="Assigned users will appear here." />
      ) : (
        <div className="site-user-grid">
          {visibleUsers.map((user) => (
            <UserAdminCard
              authUserId={auth.userId}
              isOwner={isOwner}
              key={user.id}
              user={user}
              users={visibleUsers}
              draft={draftFor(user)}
              onDraft={(patch) => updateDraft(user.id, patch)}
              onSave={(patch) => void save(user, patch)}
              onDelete={() => void remove(user)}
            />
          ))}
        </div>
      )}
      <div className="site-visits">
        <h3><ShieldAlert size={18} /> Recent visits</h3>
        {visits.length === 0 ? <p className="muted">No visits recorded yet.</p> : null}
        {visits.slice(0, 20).map((visit) => (
          <article className="visit-row" key={visit.id}>
            <strong>{visit.ip_address}</strong>
            <span>{visit.path}</span>
            <small>{userLabel(users, visit.user_id)} · {formatWhen(visit.created_at)}</small>
          </article>
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
  const selectedIds = new Set(draft.admin_managed_user_ids);
  return (
    <article className="site-user-card">
      <header>
        <div>
          <strong>{user.email}</strong>
          <small>{user.account_type} · {user.account_status} · {user.run_count} runs</small>
        </div>
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
      <Field label="Account status">
        <select
          disabled={!canEditStatus}
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
        {canEditStatus ? <Button type="button" onClick={() => onSave({ account_status: 'suspended' })}>Suspend</Button> : null}
        {canEditStatus ? <Button type="button" variant="danger" onClick={() => onSave({ account_status: 'banned' })}>Ban</Button> : null}
        {canDelete ? <Button type="button" variant="danger" onClick={onDelete}>Delete</Button> : null}
      </div>
    </article>
  );
}

function toggleId(current: Set<string>, id: string, checked: boolean) {
  const next = new Set(current);
  if (checked) next.add(id);
  else next.delete(id);
  return [...next];
}

function userLabel(users: SiteUser[], userId?: string | null) {
  if (!userId) return 'anonymous';
  return users.find((user) => user.id === userId)?.email ?? 'registered user';
}

function formatWhen(value?: string | null) {
  if (!value) return 'never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
